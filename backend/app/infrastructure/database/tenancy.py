"""Aislamiento de datos por empresa (multi-tenant).

Cada request autenticado fija la empresa en la sesion (set_tenant). A partir de ahi:
- Todo SELECT/UPDATE/DELETE del ORM sobre modelos TenantScoped se filtra por tenant_id.
- Todo registro TenantScoped nuevo recibe el tenant_id de la sesion al hacer flush.

Si una consulta toca modelos TenantScoped sin empresa fijada, se lanza error en vez
de devolver datos de todas las empresas. Las unicas consultas globales legitimas
(login, resolver el usuario del token) usan explicitamente skip_tenant_filter().
"""
import uuid

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import ORMExecuteState, Session, with_loader_criteria

from app.domain.aggregates.tenant import TenantScoped

_TENANT_KEY = "tenant_id"
_SKIP_OPTION = "skip_tenant_filter"


class TenantContextMissing(RuntimeError):
    pass


def set_tenant(session: AsyncSession | Session, tenant_id: uuid.UUID) -> None:
    session.info[_TENANT_KEY] = tenant_id


def get_tenant(session: AsyncSession | Session) -> uuid.UUID | None:
    return session.info.get(_TENANT_KEY)


def skip_tenant_filter() -> dict:
    """execution_options para una consulta global (sin filtro por empresa)."""
    return {_SKIP_OPTION: True}


def _touches_tenant_scoped(state: ORMExecuteState) -> bool:
    return any(
        isinstance(m.class_, type) and issubclass(m.class_, TenantScoped)
        for m in state.all_mappers
    )


@event.listens_for(Session, "do_orm_execute")
def _filter_by_tenant(state: ORMExecuteState) -> None:
    if not (state.is_select or state.is_update or state.is_delete):
        return
    # Las cargas de relaciones/columnas heredan el criterio de la consulta original
    if state.is_column_load or state.is_relationship_load:
        return
    if state.execution_options.get(_SKIP_OPTION):
        return

    tenant_id = state.session.info.get(_TENANT_KEY)
    if tenant_id is None:
        if _touches_tenant_scoped(state):
            raise TenantContextMissing("Consulta sin empresa (tenant) fijada en la sesion")
        return

    state.statement = state.statement.options(
        with_loader_criteria(
            TenantScoped,
            lambda cls: cls.tenant_id == tenant_id,
            include_aliases=True,
        )
    )


@event.listens_for(Session, "before_flush")
def _assign_tenant(session: Session, flush_context, instances) -> None:
    tenant_id = session.info.get(_TENANT_KEY)
    for obj in session.new:
        if isinstance(obj, TenantScoped) and obj.tenant_id is None:
            if tenant_id is None:
                raise TenantContextMissing(
                    f"No se puede crear {type(obj).__name__} sin empresa (tenant) fijada"
                )
            obj.tenant_id = tenant_id
