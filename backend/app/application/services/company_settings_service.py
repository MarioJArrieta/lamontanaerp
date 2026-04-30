from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.company_settings import CompanySettings
from app.infrastructure.repositories import CompanySettingsRepository


class CompanySettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = CompanySettingsRepository(session)

    async def get(self) -> CompanySettings | None:
        return await self.repo.get_settings()

    async def upsert(
        self,
        name: str,
        nit: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        logo_url: str | None = None,
        dian_facturador_url: str | None = None,
        dian_facturador_api_key: str | None = None,
    ) -> CompanySettings:
        existing = await self.repo.get_settings()
        if existing:
            updates: dict = {
                "name": name,
                "nit": nit,
                "phone": phone,
                "address": address,
                "logo_url": logo_url,
                "dian_facturador_url": dian_facturador_url,
            }
            # Only overwrite api_key if a new non-empty value is sent. Empty string clears it.
            if dian_facturador_api_key is not None:
                updates["dian_facturador_api_key"] = dian_facturador_api_key or None
            return await self.repo.update(existing, updates)
        settings = CompanySettings(
            name=name,
            nit=nit,
            phone=phone,
            address=address,
            logo_url=logo_url,
            dian_facturador_url=dian_facturador_url,
            dian_facturador_api_key=dian_facturador_api_key,
        )
        return await self.repo.create(settings)
