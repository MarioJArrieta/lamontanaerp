from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "La Montana ERP"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/la_montana_erp"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours

    # Siigo
    siigo_api_url: str = "https://api.siigo.com"
    siigo_api_key: str = ""
    siigo_access_token: str = ""

    # Production defaults
    pacas_per_bobina: int = 250
    bolsas_per_paca: int = 40
    default_credit_days: int = 7

    # Loyalty (Gotas)
    gotas_per_paca: int = 1
    gotas_per_botellon: int = 1
    gotas_to_redeem_paca: int = 100

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
