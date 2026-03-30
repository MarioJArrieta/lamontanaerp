from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base
from app.domain.enums import UserRole


class User(Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)
