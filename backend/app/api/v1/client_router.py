import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import (
    ClientCreate,
    ClientCreateResponse,
    ClientPasswordResponse,
    ClientPriceResponse,
    ClientPriceSet,
    ClientResponse,
    ClientUpdate,
)
from app.application.services.client_service import ClientService
from app.auth.dependencies import get_current_user, require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/clients", tags=["clients"])

AdminOrSecretary = Annotated[User, Depends(require_role(UserRole.ADMIN, UserRole.SECRETARY))]


@router.get("", response_model=list[ClientResponse])
async def list_clients(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = ClientService(db)
    return await service.get_all()


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    service = ClientService(db)
    client = await service.get_by_id(client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client


@router.post("", response_model=ClientCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    body: ClientCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ClientService(db)
    try:
        client, plain_password = await service.create(
            name=body.name,
            client_type=body.client_type,
            cedula_nit=body.cedula_nit,
            address=body.address,
            delivery_zone=body.delivery_zone,
            phone=body.phone,
            email=body.email,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return ClientCreateResponse.model_validate(
        client, from_attributes=True
    ).model_copy(update={"generated_password": plain_password})


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: uuid.UUID,
    body: ClientUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ClientService(db)
    try:
        client = await service.update(client_id, body.model_dump(exclude_unset=True))
    except ValueError as e:
        msg = str(e)
        code = (
            status.HTTP_404_NOT_FOUND
            if msg == "Client not found"
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(status_code=code, detail=msg)
    return client


@router.get("/{client_id}/prices", response_model=list[ClientPriceResponse])
async def get_client_prices(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ClientService(db)
    try:
        return await service.get_prices(client_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/{client_id}/prices", response_model=ClientPriceResponse)
async def set_client_price(
    client_id: uuid.UUID,
    body: ClientPriceSet,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ClientService(db)
    return await service.set_price(client_id, body.product_id, float(body.price))


@router.delete(
    "/{client_id}/prices/{product_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_client_price(
    client_id: uuid.UUID,
    product_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminOrSecretary,
):
    service = ClientService(db)
    deleted = await service.delete_price(client_id, product_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Price not found"
        )


@router.post(
    "/{client_id}/password/reset",
    response_model=ClientPasswordResponse,
)
async def reset_client_password(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_role(UserRole.ADMIN))],
):
    service = ClientService(db)
    try:
        client, plain_password = await service.reset_password(client_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(e)
        )
    return ClientPasswordResponse(
        client_id=client.id,
        client_name=client.name,
        phone=client.phone,
        generated_password=plain_password,
    )
