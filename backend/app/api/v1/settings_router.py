import base64
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import CompanySettingsResponse, CompanySettingsUpdate
from app.application.services.company_settings_service import CompanySettingsService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.aggregates.company_settings import CompanySettings
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


def _to_response(settings: CompanySettings) -> CompanySettingsResponse:
    api_key = settings.dian_facturador_api_key
    masked: str | None = None
    if api_key:
        masked = f"{api_key[:4]}{'•' * 16}{api_key[-4:]}" if len(api_key) >= 12 else "•" * 8
    return CompanySettingsResponse(
        id=settings.id,
        name=settings.name,
        nit=settings.nit,
        phone=settings.phone,
        address=settings.address,
        logo_url=settings.logo_url,
        dian_facturador_url=settings.dian_facturador_url,
        dian_facturador_api_key_masked=masked,
        dian_facturador_configured=bool(api_key and settings.dian_facturador_url),
    )


@router.get("")
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = CompanySettingsService(db)
    settings = await service.get()
    if not settings:
        return None
    return _to_response(settings)


@router.put("", response_model=CompanySettingsResponse)
async def update_settings(
    body: CompanySettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = CompanySettingsService(db)
    settings = await service.upsert(
        name=body.name,
        nit=body.nit,
        phone=body.phone,
        address=body.address,
        logo_url=body.logo_url,
        dian_facturador_url=body.dian_facturador_url,
        dian_facturador_api_key=body.dian_facturador_api_key,
    )
    return _to_response(settings)


@router.post("/dian/test-connection")
async def test_dian_connection(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = CompanySettingsService(db)
    settings = await service.get()
    if not settings or not settings.dian_facturador_url or not settings.dian_facturador_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Configura primero la URL y API Key del facturador DIAN",
        )
    base = settings.dian_facturador_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{base}/erp/v1/me",
                headers={"X-API-Key": settings.dian_facturador_api_key},
            )
        if r.status_code == 200:
            data = r.json()
            return {
                "ok": True,
                "message": f"Conexion exitosa con {data.get('name', 'tenant')}",
                "tenant": data,
            }
        if r.status_code in (401, 403):
            return {"ok": False, "message": "API Key invalida"}
        return {"ok": False, "message": f"HTTP {r.status_code}: {r.text[:200]}"}
    except httpx.RequestError as e:
        return {"ok": False, "message": f"No se pudo conectar: {e}"}


@router.post("/logo", response_model=dict)
async def upload_logo(
    _: AdminUser,
    file: UploadFile = File(...),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen",
        )
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen no debe superar 2MB",
        )
    b64 = base64.b64encode(contents).decode()
    data_url = f"data:{file.content_type};base64,{b64}"
    return {"logo_url": data_url}
