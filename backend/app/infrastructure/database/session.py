import ssl as _ssl
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

# Fly.io internal postgres doesn't use SSL; detect by .flycast or .internal in URL
_connect_args: dict = {}
if ".flycast" in settings.database_url or ".internal" in settings.database_url:
    _connect_args["ssl"] = False

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args=_connect_args,
    # Descarta conexiones muertas antes de usarlas (p. ej. tras un reinicio de la DB)
    # para no requerir reiniciar el backend a mano.
    pool_pre_ping=True,
    pool_recycle=1800,
)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
