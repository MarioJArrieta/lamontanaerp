"""Crea una empresa (tenant) nueva con su usuario administrador.

Uso:
    python -m app.create_tenant --name "H2O Pure" --slug h2opure \
        --username h20pure --password '...' --full-name "Administrador H2O Pure"
"""
import argparse
import asyncio

from sqlalchemy import select

from app.application.services.auth_service import AuthService
from app.domain.aggregates import CompanySettings, Tenant
from app.domain.enums import UserRole
from app.infrastructure.database import async_session_factory, engine
from app.infrastructure.database.tenancy import set_tenant


async def create_tenant(name: str, slug: str, username: str, password: str, full_name: str) -> None:
    async with async_session_factory() as session:
        if (await session.execute(select(Tenant).where(Tenant.slug == slug))).scalar_one_or_none():
            raise SystemExit(f"Ya existe una empresa con slug '{slug}'")

        tenant = Tenant(name=name, slug=slug)
        session.add(tenant)
        await session.flush()
        set_tenant(session, tenant.id)

        session.add(CompanySettings(name=name))
        try:
            await AuthService(session).create_user(
                username=username,
                password=password,
                full_name=full_name,
                role=UserRole.ADMIN,
            )
        except ValueError as e:
            raise SystemExit(str(e))

        await session.commit()
        print(f"Empresa '{name}' creada (id={tenant.id}) con admin '{username}'")

    await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", required=True, help="Nombre de la empresa")
    parser.add_argument("--slug", required=True, help="Identificador corto unico, p. ej. h2opure")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--full-name", required=True, help="Nombre del usuario administrador")
    args = parser.parse_args()
    asyncio.run(create_tenant(args.name, args.slug, args.username, args.password, args.full_name))


if __name__ == "__main__":
    main()
