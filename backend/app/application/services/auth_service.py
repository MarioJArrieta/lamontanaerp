from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token, hash_password, verify_password
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.repositories import UserRepository


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)

    async def authenticate(self, username: str, password: str) -> str | None:
        user = await self.repo.get_by_username(username)
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return create_access_token(data={"sub": user.username, "role": user.role.value})

    async def create_user(
        self, username: str, password: str, full_name: str, role: UserRole
    ) -> User:
        existing = await self.repo.get_by_username(username)
        if existing:
            raise ValueError(f"Username '{username}' already exists")
        user = User(
            username=username,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=role,
        )
        return await self.repo.create(user)
