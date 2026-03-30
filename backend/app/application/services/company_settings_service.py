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
    ) -> CompanySettings:
        existing = await self.repo.get_settings()
        if existing:
            updates = {
                "name": name,
                "nit": nit,
                "phone": phone,
                "address": address,
                "logo_url": logo_url,
            }
            return await self.repo.update(existing, updates)
        settings = CompanySettings(
            name=name,
            nit=nit,
            phone=phone,
            address=address,
            logo_url=logo_url,
        )
        return await self.repo.create(settings)
