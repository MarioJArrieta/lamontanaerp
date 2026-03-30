/** Coerce null to empty string for Select onValueChange */
export function sv(v: string | null): string {
  return v ?? '';
}
