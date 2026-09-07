import { weekDayLabelsByLanguage, type Language } from '../i18n';
import { getDayOfWeek, isValidDate } from './dateTime';
import { getSundayOfWeek, type WeekDay } from './week';

export type WeekdayFilter = 'all' | 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function getWeekStartForSpecificDate(date: string): string {
  if (!isValidDate(date)) {
    throw new Error(`Invalid date: ${date}`);
  }

  return getSundayOfWeek(date);
}

export function getVisibleWeekDays(
  weekDays: WeekDay[],
  weekdayFilter: WeekdayFilter,
  specificDate: string,
  language: Language,
): WeekDay[] {
  if (specificDate !== '') {
    if (!isValidDate(specificDate)) {
      return weekDays;
    }

    const selectedDay = weekDays.find((day) => day.date === specificDate);

    return selectedDay === undefined
      ? [{ date: specificDate, label: weekDayLabelsByLanguage[language][getDayOfWeek(specificDate)] ?? '' }]
      : [selectedDay];
  }

  if (weekdayFilter === 'all') {
    return weekDays;
  }

  return weekDays.filter((day) => getDayOfWeek(day.date) === weekdayFilter);
}
