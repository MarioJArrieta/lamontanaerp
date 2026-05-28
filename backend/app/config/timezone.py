"""Helpers de zona horaria para la operacion (America/Bogota, UTC-5)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

BOGOTA_TZ = ZoneInfo("America/Bogota")


def bogota_now() -> datetime:
    """Datetime actual en America/Bogota (con tzinfo)."""
    return datetime.now(BOGOTA_TZ)


def bogota_today() -> date:
    """Fecha calendario hoy en America/Bogota."""
    return bogota_now().date()


def bogota_day_bounds(target_date: date) -> tuple[datetime, datetime]:
    """Inicio y fin del dia en Bogota como datetimes con tz UTC para queries SQL.

    Retorna [00:00:00, 23:59:59.999999] del dia local convertido a UTC.
    Compatible con columnas TIMESTAMP WITHOUT TIME ZONE (las pasamos como
    datetimes naive en UTC mediante .replace(tzinfo=None)).
    """
    start_local = datetime.combine(target_date, datetime.min.time(), tzinfo=BOGOTA_TZ)
    end_local = datetime.combine(target_date, datetime.max.time(), tzinfo=BOGOTA_TZ)
    return start_local, end_local
