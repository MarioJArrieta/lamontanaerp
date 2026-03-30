import base64
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas import CompanySettingsResponse, CompanySettingsUpdate
from app.application.services.company_settings_service import CompanySettingsService
from app.auth.dependencies import require_role
from app.domain.aggregates.user import User
from app.domain.enums import UserRole
from app.infrastructure.database import get_db

router = APIRouter(prefix="/settings", tags=["settings"])

AdminUser = Annotated[User, Depends(require_role(UserRole.ADMIN))]


@router.get("")
async def get_settings(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = CompanySettingsService(db)
    settings = await service.get()
    if not settings:
        return None
    return CompanySettingsResponse.model_validate(settings)


@router.put("", response_model=CompanySettingsResponse)
async def update_settings(
    body: CompanySettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: AdminUser,
):
    service = CompanySettingsService(db)
    return await service.upsert(
        name=body.name,
        nit=body.nit,
        phone=body.phone,
        address=body.address,
        logo_url=body.logo_url,
    )


@router.post("/logo", response_model=dict)
async def upload_logo(
    _: AdminUser,
    file: UploadFile = File(...),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo debe ser una imagen",
        )
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen no debe superar 2MB",
        )
    b64 = base64.b64encode(contents).decode()
    data_url = f"data:{file.content_type};base64,{b64}"
    return {"logo_url": data_url}
