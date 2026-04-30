"""Sends a Sale to the facturador-dian system as a DIAN electronic invoice."""
import logging
import uuid
from decimal import Decimal
from pathlib import Path

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.sale import Sale
from app.infrastructure.repositories import (
    ClientRepository,
    CompanySettingsRepository,
    ProductRepository,
    SaleRepository,
)

logger = logging.getLogger(__name__)

DIAN_PDF_DIR = Path(__file__).resolve().parents[3] / "storage" / "dian"


class ElectronicInvoiceError(Exception):
    """Raised when DIAN electronic invoicing fails (config, mapping, network, DIAN reject)."""


class ElectronicInvoiceService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.sale_repo = SaleRepository(session)
        self.client_repo = ClientRepository(session)
        self.product_repo = ProductRepository(session)
        self.settings_repo = CompanySettingsRepository(session)

    async def send(self, sale_id: uuid.UUID) -> Sale:
        sale = await self.sale_repo.get_by_id_with_items(sale_id)
        if not sale:
            raise ElectronicInvoiceError("Venta no encontrada")
        if sale.dian_status == "accepted":
            raise ElectronicInvoiceError("Esta venta ya tiene factura electronica aceptada")

        settings = await self.settings_repo.get_settings()
        if not settings or not settings.dian_facturador_url or not settings.dian_facturador_api_key:
            raise ElectronicInvoiceError(
                "El facturador DIAN no esta configurado. Configura URL y API Key en Settings."
            )

        client = await self.client_repo.get_by_id_with_prices(sale.client_id)
        if not client:
            raise ElectronicInvoiceError("Cliente de la venta no encontrado")
        if not client.dian_id_type:
            raise ElectronicInvoiceError(
                "El cliente no tiene tipo de documento DIAN. Editalo y selecciona uno."
            )
        if not client.electronic_invoicing_enabled:
            raise ElectronicInvoiceError(
                "El cliente no tiene habilitada la factura electronica"
            )

        # Build lines payload
        lines: list[dict] = []
        for item in sale.items:
            product = await self.product_repo.get_by_id(item.product_id)
            if not product:
                raise ElectronicInvoiceError(f"Producto {item.product_id} no encontrado")
            tax_rate = product.tax_rate or Decimal("0")
            line_subtotal = item.subtotal
            line_tax = (line_subtotal * tax_rate / Decimal("100")).quantize(Decimal("0.01"))
            lines.append({
                "description": product.name,
                "quantity": str(item.quantity),
                "unit_price": str(item.unit_price),
                "subtotal": str(line_subtotal),
                "tax_rate": str(tax_rate),
                "tax_amount": str(line_tax),
                "unit_code": "94",
                "product_code": str(product.id)[:50],
                "tax_type": product.dian_tax_type or "ZZ",
            })

        external_ref = sale.dian_external_ref or f"sale-{sale.id}"

        payload = {
            "external_ref": external_ref,
            "issue_date": sale.date.isoformat(),
            "customer": {
                "id_type": client.dian_id_type,
                "id_number": client.cedula_nit,
                "name": client.name,
                "email": client.email,
                "address": client.address,
                "phone": client.phone,
            },
            "currency": "COP",
            "lines": lines,
            "subtotal": str(sale.subtotal),
            "tax_total": str(sale.tax),
            "total": str(sale.total),
            "notes": sale.notes,
        }

        base = settings.dian_facturador_url.rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=60.0) as client_http:
                response = await client_http.post(
                    f"{base}/erp/v1/invoices",
                    headers={"X-API-Key": settings.dian_facturador_api_key},
                    json=payload,
                )
        except httpx.RequestError as e:
            raise ElectronicInvoiceError(f"No se pudo contactar al facturador DIAN: {e}")

        if response.status_code not in (200, 201):
            try:
                detail = response.json().get("detail", response.text)
            except Exception:
                detail = response.text
            raise ElectronicInvoiceError(
                f"Facturador DIAN respondio {response.status_code}: {detail}"
            )

        data = response.json()
        sale.dian_external_ref = external_ref
        sale.dian_document_number = data.get("document_number")
        sale.dian_cufe = data.get("cufe")
        sale.dian_status = data.get("status")
        sale.dian_status_message = data.get("dian_status_message")

        # If accepted, fetch and cache the PDF immediately so it survives even
        # if the facturador goes down later. The cache also blocks re-sending.
        if sale.dian_status == "accepted":
            try:
                invoice_id = data.get("id")
                if invoice_id:
                    pdf_bytes = await self._fetch_pdf_from_facturador(
                        base=settings.dian_facturador_url.rstrip("/"),
                        api_key=settings.dian_facturador_api_key,
                        invoice_id=invoice_id,
                    )
                    sale.dian_pdf_path = self._save_pdf_to_disk(sale.id, pdf_bytes)
            except Exception as e:
                logger.warning("PDF cache failed for sale %s: %s", sale.id, e)

        await self.session.flush()
        return sale

    @staticmethod
    async def _fetch_pdf_from_facturador(base: str, api_key: str, invoice_id: str) -> bytes:
        async with httpx.AsyncClient(timeout=30.0) as http:
            r = await http.get(
                f"{base}/erp/v1/invoices/{invoice_id}/pdf",
                headers={"X-API-Key": api_key},
            )
            r.raise_for_status()
            return r.content

    @staticmethod
    def _save_pdf_to_disk(sale_id: uuid.UUID, content: bytes) -> str:
        DIAN_PDF_DIR.mkdir(parents=True, exist_ok=True)
        path = DIAN_PDF_DIR / f"{sale_id}.pdf"
        path.write_bytes(content)
        return str(path)

    async def download_pdf(self, sale_id: uuid.UUID) -> tuple[bytes, str]:
        """Return the signed PDF for a sale's DIAN invoice. Uses local cache when present."""
        sale = await self.sale_repo.get_by_id_with_items(sale_id)
        if not sale:
            raise ElectronicInvoiceError("Venta no encontrada")
        if sale.dian_status != "accepted":
            raise ElectronicInvoiceError("Esta venta no tiene factura electronica aceptada")
        if not sale.dian_external_ref:
            raise ElectronicInvoiceError("La venta no tiene referencia DIAN")

        filename = f"{sale.dian_document_number or 'factura'}.pdf"

        if sale.dian_pdf_path:
            cached = Path(sale.dian_pdf_path)
            if cached.exists():
                return cached.read_bytes(), filename

        settings = await self.settings_repo.get_settings()
        if not settings or not settings.dian_facturador_url or not settings.dian_facturador_api_key:
            raise ElectronicInvoiceError("El facturador DIAN no esta configurado")

        base = settings.dian_facturador_url.rstrip("/")
        headers = {"X-API-Key": settings.dian_facturador_api_key}
        try:
            async with httpx.AsyncClient(timeout=30.0) as http:
                lookup = await http.get(
                    f"{base}/erp/v1/invoices/by-ref/{sale.dian_external_ref}",
                    headers=headers,
                )
                if lookup.status_code == 404:
                    raise ElectronicInvoiceError("Factura no encontrada en el facturador DIAN")
                if lookup.status_code != 200:
                    raise ElectronicInvoiceError(
                        f"Facturador respondio {lookup.status_code} al buscar la factura"
                    )
                invoice_id = lookup.json().get("id")
                if not invoice_id:
                    raise ElectronicInvoiceError("Respuesta del facturador sin id de factura")

                pdf_resp = await http.get(
                    f"{base}/erp/v1/invoices/{invoice_id}/pdf",
                    headers=headers,
                )
        except httpx.RequestError as e:
            raise ElectronicInvoiceError(f"No se pudo contactar al facturador DIAN: {e}")

        if pdf_resp.status_code != 200:
            raise ElectronicInvoiceError(
                f"Facturador respondio {pdf_resp.status_code} al descargar el PDF"
            )

        sale.dian_pdf_path = self._save_pdf_to_disk(sale.id, pdf_resp.content)
        await self.session.flush()
        await self.session.commit()
        return pdf_resp.content, filename
