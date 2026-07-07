/** Calendar date in local timezone as YYYY-MM-DD */
export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseExpenseDateParts(
  dateStr?: string | null,
  fallbackIso?: string | null,
): { year: number; month: number; day: number } | null {
  if (dateStr) {
    const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { year: +m[1], month: +m[2] - 1, day: +m[3] };
  }
  if (fallbackIso) {
    const d = new Date(fallbackIso);
    if (!isNaN(d.getTime())) {
      return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
    }
  }
  return null;
}

export function entryMatchesMonthYear(
  dateStr: string | undefined | null,
  fallbackIso: string | undefined | null,
  month: number,
  year: number,
): boolean {
  const parts = parseExpenseDateParts(dateStr, fallbackIso);
  if (!parts) return false;
  return parts.month === month && parts.year === year;
}

export function formatExpenseDate(
  dateStr?: string | null,
  fallbackIso?: string | null,
): string {
  const parts = parseExpenseDateParts(dateStr, fallbackIso);
  if (!parts) return '—';
  return new Date(parts.year, parts.month, parts.day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
