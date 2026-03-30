import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.aggregates.base import Base
from app.domain.enums import InventoryMovementType


class Inventory(Base):
    __tablename__ = "inventory"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), unique=True, nullable=False
    )
    quantity: Mapped[int] = mapped_column(nullable=False, default=0)

    product = relationship("Product")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), nullable=False
    )
    movement_type: Mapped[InventoryMovementType] = mapped_column(nullable=False)
    quantity: Mapped[int] = mapped_column(nullable=False)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    product = relationship("Product")
