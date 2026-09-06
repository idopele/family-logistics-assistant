/** Validates an exact 24-hour HH:mm time, from 00:00 through 23:59. */
export function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Validates YYYY-MM-DD and a real Gregorian date in years 0001–9999. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (year < 1 || month < 1 || month > 12 || day < 1) {
    return false;
  }

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return day <= daysInMonth[month - 1];
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function parseDateParts(value: string): DateParts {
  if (!isValidDate(value)) {
    throw new Error(`Invalid date: ${value}`);
  }

  return {
    year: Number(value.slice(0, 4)),
    month: Number(value.slice(5, 7)),
    day: Number(value.slice(8, 10)),
  };
}

export function compareDates(first: string, second: string): number {
  if (!isValidDate(first)) {
    throw new Error(`Invalid date: ${first}`);
  }

  if (!isValidDate(second)) {
    throw new Error(`Invalid date: ${second}`);
  }

  return first.localeCompare(second);
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  return toDayNumber(end) - toDayNumber(start);
}

export function getDayOfWeek(date: string): number {
  const { year, month, day } = parseDateParts(date);
  const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const adjustedYear = month < 3 ? year - 1 : year;

  return (
    adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) +
    monthOffsets[month - 1] +
    day
  ) % 7;
}

export function monthsBetween(startDate: string, endDate: string): number {
  const start = parseDateParts(startDate);
  const end = parseDateParts(endDate);

  return (end.year - start.year) * 12 + (end.month - start.month);
}

export function addDays(date: string, days: number): string {
  const parts = parseDateParts(date);
  const dayNumber = toDayNumber(parts) + days;

  return formatDateParts(fromDayNumber(dayNumber));
}

function toDayNumber({ year, month, day }: DateParts): number {
  const adjustedYear = month <= 2 ? year - 1 : year;
  const adjustedMonth = month <= 2 ? month + 12 : month;

  return (
    365 * adjustedYear +
    Math.floor(adjustedYear / 4) -
    Math.floor(adjustedYear / 100) +
    Math.floor(adjustedYear / 400) +
    Math.floor((153 * (adjustedMonth - 3) + 2) / 5) +
    day -
    1
  );
}

function fromDayNumber(dayNumber: number): DateParts {
  const era = Math.floor(dayNumber / 146097);
  const dayOfEra = dayNumber - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime < 10 ? monthPrime + 3 : monthPrime - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);

  return { year, month, day };
}

function formatDateParts({ year, month, day }: DateParts): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}
