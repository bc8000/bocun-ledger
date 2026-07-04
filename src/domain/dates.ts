export function nowIsoString(): string {
  return new Date().toISOString();
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayISODate(): string {
  return toISODate(new Date());
}

export function getMonthRange(referenceDate = todayISODate()): { start: string; end: string } {
  const [year, month] = referenceDate.split('-');
  const monthIndex = Number.parseInt(month, 10) - 1;
  const firstDay = new Date(Number.parseInt(year, 10), monthIndex, 1);
  const lastDay = new Date(Number.parseInt(year, 10), monthIndex + 1, 0);

  return {
    start: toISODate(firstDay),
    end: toISODate(lastDay),
  };
}

export function addDays(isoDate: string, offset: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return toISODate(new Date(year, month - 1, day + offset));
}

export function getRecentDateRange(days: number, referenceDate = todayISODate()): { start: string; end: string; dates: string[] } {
  const count = Math.max(1, Math.floor(days));
  const start = addDays(referenceDate, -(count - 1));
  const dates = Array.from({ length: count }, (_, index) => addDays(start, index));

  return {
    start,
    end: referenceDate,
    dates,
  };
}

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
}
