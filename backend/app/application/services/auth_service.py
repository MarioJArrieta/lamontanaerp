from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token, hash_password, verify_password
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.repositories import ClientRepository, UserRepository


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)
        self.client_repo = ClientRepository(session)

    async def authenticate(
        self,
        password: str,
        username: str | None = None,
        phone: str | None = None,
    ) -> dict | None:
        # Try user login first
        user = None
        if username:
            user = await self.repo.get_by_username(username)
        elif phone:
            user = await self.repo.get_by_phone(phone)

        if user and user.is_active and verify_password(password, user.hashed_password):
            token = create_access_token(
                data={"sub": user.username, "role": user.role.value, "type": "user"}
            )
            return {"access_token": token, "token_type": "bearer", "role": user.role.value}

        # Try client login by phone
        if phone:
            client = await self.client_repo.get_by_phone(phone)
            if (
                client
                and client.is_active
                and client.hashed_password
                and verify_password(password, client.hashed_password)
            ):
                token = create_access_token(
                    data={
                        "sub": str(client.id),
                        "role": "client",
                        "type": "client",
                    }
                )
                return {
                    "access_token": token,
                    "token_type": "bearer",
                    "role": "client",
                    "client_id": str(client.id),
                    "client_name": client.name,
                }

        return None

    async def create_user(
        self,
        username: str,
        password: str,
        full_name: str,
        role: UserRole,
        phone: str | None = None,
    ) -> User:
        existing = await self.repo.get_by_username(username)
        if existing:
            raise ValueError(f"Username '{username}' already exists")
        if phone:
            existing_phone = await self.repo.get_by_phone(phone)
            if existing_phone:
                raise ValueError(f"Phone '{phone}' already exists")
        user = User(
            username=username,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=role,
            phone=phone,
        )
        return await self.repo.create(user)
