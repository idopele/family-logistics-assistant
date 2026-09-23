import { weekDayLabelsByLanguage, type Language } from '../i18n';
import type { EventCategory, ScheduleOccurrence } from '../models';
import { getOccurrenceParticipantIds } from '../services/eventParticipants';
import { getDayOfWeek, isValidDate } from './dateTime';
import { getSundayOfWeek, isDateInWorkWeek, type WeekDay } from './week';

export type WeekdayFilter = 'all' | 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type SelectedWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DashboardFilterState {
  selectedMemberIds: string[];
  selectedCategories: EventCategory[];
  selectedWeekdays: SelectedWeekday[];
  specificDate: string | null;
}

export function getWeekStartForSpecificDate(date: string): string {
  if (!isValidDate(date)) {
    throw new Error(`Invalid date: ${date}`);
  }

  return getSundayOfWeek(date);
}

export function getDefaultWeekdayFilter(today: string, weekStartDate: string): WeekdayFilter {
  if (!isValidDate(today) || !isValidDate(weekStartDate)) {
    throw new Error('Invalid schedule view date');
  }

  return isDateInWorkWeek(today, weekStartDate) ? (getDayOfWeek(today) as WeekdayFilter) : 'all';
}

export function getDefaultSelectedWeekdays(today: string, weekStartDate: string): SelectedWeekday[] {
  const defaultFilter = getDefaultWeekdayFilter(today, weekStartDate);

  return defaultFilter === 'all' ? [0, 1, 2, 3, 4, 5, 6] : [defaultFilter];
}

export function getWeekdayFilterAfterClearingSpecificDate(today: string, weekStartDate: string): WeekdayFilter {
  return getDefaultWeekdayFilter(today, weekStartDate);
}

export function getWeekdaysAfterClearingSpecificDate(
  today: string,
  weekStartDate: string,
  previousSelectedWeekdays: SelectedWeekday[],
): SelectedWeekday[] {
  return isDateInWorkWeek(today, weekStartDate)
    ? getDefaultSelectedWeekdays(today, weekStartDate)
    : normalizeSelectedWeekdays(previousSelectedWeekdays);
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

export function getVisibleWeekDaysForSelection(
  weekDays: WeekDay[],
  selectedWeekdays: SelectedWeekday[],
  specificDate: string | null,
  language: Language,
): WeekDay[] {
  if (specificDate !== null && specificDate !== '') {
    if (!isValidDate(specificDate)) {
      return weekDays;
    }

    const selectedDay = weekDays.find((day) => day.date === specificDate);

    return selectedDay === undefined
      ? [{ date: specificDate, label: weekDayLabelsByLanguage[language][getDayOfWeek(specificDate)] ?? '' }]
      : [selectedDay];
  }

  const normalizedWeekdays = normalizeSelectedWeekdays(selectedWeekdays);

  return weekDays.filter((day) => normalizedWeekdays.includes(getDayOfWeek(day.date) as SelectedWeekday));
}

export function createResetFilterState(
  today: string,
  weekStartDate: string,
  authorizedMemberIds: string[],
  authorizedCategories: EventCategory[],
): DashboardFilterState {
  return {
    selectedMemberIds: authorizedMemberIds,
    selectedCategories: authorizedCategories,
    selectedWeekdays: getDefaultSelectedWeekdays(today, weekStartDate),
    specificDate: null,
  };
}

export function sanitizeDashboardFilterState(
  state: DashboardFilterState,
  authorizedMemberIds: string[],
  authorizedCategories: EventCategory[],
): DashboardFilterState {
  return {
    selectedMemberIds: sanitizeSelection(state.selectedMemberIds, authorizedMemberIds),
    selectedCategories: sanitizeSelection(state.selectedCategories, authorizedCategories),
    selectedWeekdays: normalizeSelectedWeekdays(state.selectedWeekdays),
    specificDate: state.specificDate !== null && isValidDate(state.specificDate) ? state.specificDate : null,
  };
}

export function filterOccurrencesForDashboard(
  occurrences: ScheduleOccurrence[],
  filters: DashboardFilterState,
  authorizedMemberIds: string[],
  authorizedCategories: EventCategory[],
): ScheduleOccurrence[] {
  const selectedMemberIds = sanitizeSelection(filters.selectedMemberIds, authorizedMemberIds);
  const selectedCategories = sanitizeSelection(filters.selectedCategories, authorizedCategories);
  const selectedWeekdays = normalizeSelectedWeekdays(filters.selectedWeekdays);

  return occurrences.filter((occurrence) => {
    const matchesMember = getOccurrenceParticipantIds(occurrence).some((participantId) => selectedMemberIds.includes(participantId));
    const matchesCategory = selectedCategories.includes(occurrence.category);
    const matchesDate =
      filters.specificDate !== null && filters.specificDate !== ''
        ? occurrence.date === filters.specificDate
        : selectedWeekdays.includes(getDayOfWeek(occurrence.date) as SelectedWeekday);

    return matchesMember && matchesCategory && matchesDate;
  });
}

export function normalizeSelectedWeekdays(selectedWeekdays: SelectedWeekday[]): SelectedWeekday[] {
  const selected = Array.from(new Set(selectedWeekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort(
    (first, second) => first - second,
  ) as SelectedWeekday[];

  return selected.length > 0 ? selected : [0, 1, 2, 3, 4, 5, 6];
}

function sanitizeSelection<T extends string>(selectedValues: T[], authorizedValues: T[]): T[] {
  const allowed = selectedValues.filter((value) => authorizedValues.includes(value));

  return allowed.length > 0 ? Array.from(new Set(allowed)) : authorizedValues;
}
