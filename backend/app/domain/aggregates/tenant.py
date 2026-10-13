import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.aggregates.base import Base

# Empresa original: todos los datos anteriores al multi-tenant quedan asignados a ella.
LA_MONTANA_TENANT_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class Tenant(Base):
    """Empresa cliente del ERP. Cada empresa ve unicamente sus propios datos."""

    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)


class TenantScoped:
    """Mixin para tablas cuyos registros pertenecen a una empresa.

    El filtro por empresa y la asignacion de tenant_id al crear registros los hace
    automaticamente app.infrastructure.database.tenancy.
    """

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True
    )
