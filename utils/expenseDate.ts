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

/** India FY: 1 Apr → 31 Mar */
export function indiaFinancialYearStartYear(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export type ExpenseExportPreset = 'this_month' | 'last_6_months' | 'current_fy' | 'last_fy';

export function expenseExportRange(
  preset: ExpenseExportPreset,
  today = new Date(),
): { from: string; to: string; label: string } {
  const to = localDateString(today);

  if (preset === 'this_month') {
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    return { from, to, label: 'This month' };
  }

  if (preset === 'last_6_months') {
    const start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { from: localDateString(start), to, label: 'Last 6 months' };
  }

  const fyStart = indiaFinancialYearStartYear(today);
  if (preset === 'current_fy') {
    const fyEnd = `${fyStart + 1}-03-31`;
    return {
      from: `${fyStart}-04-01`,
      to: to < fyEnd ? to : fyEnd,
      label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}`,
    };
  }

  const lastStart = fyStart - 1;
  return {
    from: `${lastStart}-04-01`,
    to: `${lastStart + 1}-03-31`,
    label: `FY ${lastStart}-${String(lastStart + 1).slice(2)}`,
  };
}
