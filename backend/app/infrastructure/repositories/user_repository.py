from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.aggregates.user import User
from app.infrastructure.database.tenancy import skip_tenant_filter
from app.infrastructure.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, User)

    # username y phone son unicos entre todas las empresas: se buscan globalmente
    # porque se usan en el login, antes de conocer la empresa del usuario.
    async def get_by_username(self, username: str) -> User | None:
        stmt = select(User).where(User.username == username).execution_options(**skip_tenant_filter())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> User | None:
        stmt = select(User).where(User.phone == phone).execution_options(**skip_tenant_filter())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
