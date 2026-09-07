import { addDays, daysBetween, getDayOfWeek, parseDateParts } from './dateTime';
import { monthLabelsByLanguage, weekDayLabelsByLanguage, type Language } from '../i18n';

export interface WeekDay {
  date: string;
  label: string;
}

export const weekDayLabels = weekDayLabelsByLanguage.he;

export function getTodayDateString(): string {
  const now = new Date();

  return formatDateParts(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getSundayOfWeek(date: string): string {
  return addDays(date, -getDayOfWeek(date));
}

export function getWorkWeekDays(weekStartDate: string, language: Language = 'he'): WeekDay[] {
  return weekDayLabelsByLanguage[language].map((label, index) => ({
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

export function formatWeekRange(weekStartDate: string, language: Language = 'he'): string {
  const start = parseDateParts(weekStartDate);
  const end = parseDateParts(addDays(weekStartDate, 6));

  if (language === 'en') {
    if (start.month === end.month) {
      return `${monthLabelsByLanguage.en[start.month - 1]} ${start.day}-${end.day}, ${end.year}`;
    }

    return `${monthLabelsByLanguage.en[start.month - 1]} ${start.day}-${monthLabelsByLanguage.en[end.month - 1]} ${end.day}, ${end.year}`;
  }

  const startLabel = `${start.day}.${start.month}`;
  const endLabel = `${end.day}.${end.month}.${end.year}`;

  return `${startLabel}–${endLabel}`;
}

export function formatFullDisplayDate(date: string, language: Language = 'he'): string {
  const { day, month } = parseDateParts(date);
  const dayLabel = weekDayLabelsByLanguage[language][getDayOfWeek(date)];
  const monthLabel = monthLabelsByLanguage[language][month - 1];

  return language === 'he' ? `יום ${dayLabel} · ${day} ב${monthLabel}` : `${dayLabel} · ${monthLabel} ${day}`;
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
}
