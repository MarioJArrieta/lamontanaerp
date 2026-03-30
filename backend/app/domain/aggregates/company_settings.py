from typing import Optional

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base


class CompanySettings(Base):
    __tablename__ = "company_settings"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    nit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
