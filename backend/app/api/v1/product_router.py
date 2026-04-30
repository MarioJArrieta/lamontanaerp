import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import ProductCreate, ProductResponse, ProductUpdate
from app.application.services.product_service import ProductService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/products", tags=["products"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("", response_model=list[ProductResponse])
async def list_products(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = ProductService(db)
    return await service.get_all()


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = ProductService(db)
    product = await service.create(
        name=body.name,
        product_type=body.product_type,
        unit=body.unit,
        base_price=body.base_price,
        tax_rate=body.tax_rate,
        dian_tax_type=body.dian_tax_type,
        tax_included=body.tax_included,
    )
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = ProductService(db)
    try:
        product = await service.update(product_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    return product
