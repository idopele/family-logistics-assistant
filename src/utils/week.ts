import { addDays, daysBetween, getDayOfWeek, parseDateParts } from './dateTime';

export interface WeekDay {
  date: string;
  label: string;
}

export const weekDayLabels = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;

export function getTodayDateString(): string {
  const now = new Date();

  return formatDateParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getSundayOfWeek(date: string): string {
  return addDays(date, -getDayOfWeek(date));
}

export function getWorkWeekDays(weekStartDate: string): WeekDay[] {
  return weekDayLabels.map((label, index) => ({
    date: addDays(weekStartDate, index),
    label,
  }));
}

export function getNextWeekStart(weekStartDate: string): string {
  return addDays(weekStartDate, 7);
}

export function getPreviousWeekStart(weekStartDate: string): string {
  return addDays(weekStartDate, -7);
}

export function isDateInWorkWeek(date: string, weekStartDate: string): boolean {
  const difference = daysBetween(weekStartDate, date);

  return difference >= 0 && difference <= 6;
}

export function formatDisplayDate(date: string): string {
  const { day, month } = parseDateParts(date);

  return `${day}.${month}`;
}

export function formatWeekRange(weekStartDate: string): string {
  const start = parseDateParts(weekStartDate);
  const end = parseDateParts(addDays(weekStartDate, 6));

  const startLabel = `${start.day}.${start.month}`;
  const endLabel = `${end.day}.${end.month}.${end.year}`;

  return `${startLabel}–${endLabel}`;
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}
