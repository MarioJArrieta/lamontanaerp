/** Coerce null to empty string for Select onValueChange */
export function sv(v: string | null): string {
  return v ?? '';
}

/** YYYY-MM-DD para una fecha JS en zona America/Bogota. */
export function bogotaDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value ?? '1970';
  const m = parts.find(p => p.type === 'month')?.value ?? '01';
  const d = parts.find(p => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD del día de hoy en zona America/Bogota. */
export function bogotaToday(): string {
  return bogotaDate(new Date());
}

/** YYYY-MM-DD de hace N dias en zona America/Bogota. */
export function bogotaDaysAgo(days: number): string {
  return bogotaDate(new Date(Date.now() - days * 86400000));
}
