from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.company_settings import CompanySettings
from app.infrastructure.repositories.base_repository import BaseRepository


class CompanySettingsRepository(BaseRepository[CompanySettings]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, CompanySettings)

    async def get_settings(self) -> CompanySettings | None:
        stmt = select(CompanySettings).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
