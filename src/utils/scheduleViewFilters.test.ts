import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { translations, weekDayLabelsByLanguage } from '../i18n';
import { buildFamilyActionCenterData } from '../services/familyActionCenter';
import type { Child, Event, ScheduleOccurrence } from '../models';
import { HomePage } from '../pages/HomePage';
import { getWorkWeekDays } from './week';
import {
  createResetFilterState,
  filterOccurrencesForDashboard,
  getDefaultSelectedWeekdays,
  getDefaultWeekdayFilter,
  getVisibleWeekDays,
  getVisibleWeekDaysForSelection,
  getWeekdayFilterAfterClearingSpecificDate,
  getWeekdaysAfterClearingSpecificDate,
  getWeekStartForSpecificDate,
  sanitizeDashboardFilterState,
  type DashboardFilterState,
  type WeekdayFilter,
} from './scheduleViewFilters';

const children: Child[] = [{ id: 'daniel', name: 'Daniel', color: '#2563EB', isActive: true }];

const event: Event = {
  id: 'event-a',
  childId: 'daniel',
  title: 'Practice',
  category: 'basketball',
  customCategoryLabel: null,
  date: '2026-09-08',
  startTime: '17:00',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function dashboardOccurrence(
  eventId: string,
  childId: string,
  category: ScheduleOccurrence['category'],
  date: string,
  participantIds?: string[],
): ScheduleOccurrence {
  return {
    eventId,
    childId,
    participantIds,
    date,
    title: eventId,
    category,
    customCategoryLabel: null,
    startTime: '08:00',
    endTime: null,
    endsNextDay: false,
    location: null,
    notes: null,
    status: 'scheduled',
    requiresTransportation: false,
    pickupTime: null,
    dropoffTime: null,
    isException: false,
  };
}

describe('schedule view date filters', () => {
  it('initial current week shows the current weekday only', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12, 0, 0));

    const markup = renderToStaticMarkup(createElement(HomePage));

    expect(markup.match(/class="day-schedule"/g)).toHaveLength(1);
    expect(markup).toContain('dateTime="2026-09-09"');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('defaults the current week to the local current weekday', () => {
    expect(getDefaultWeekdayFilter('2026-09-09', '2026-09-06')).toBe(3);
  });

  it('uses all days when the viewed week is not the current week', () => {
    expect(getDefaultWeekdayFilter('2026-09-09', '2026-09-13')).toBe('all');
  });

  it('weekday filter shows the correct selected week day', () => {
    const weekDays = getWorkWeekDays('2026-09-06', 'en');

    expect(getVisibleWeekDays(weekDays, 2, '', 'en')).toEqual([{ date: '2026-09-08', label: 'Tuesday' }]);
  });

  it('preserves Sunday-Saturday weekday numbering', () => {
    expect(weekDayLabelsByLanguage.en[0]).toBe('Sunday');
    expect(weekDayLabelsByLanguage.en[6]).toBe('Saturday');
    expect(getDefaultWeekdayFilter('2026-09-06', '2026-09-06')).toBe(0);
  });

  it('specific date navigates to the containing Sunday-Saturday week', () => {
    expect(getWeekStartForSpecificDate('2026-09-17')).toBe('2026-09-13');
  });

  it('specific date shows only the exact day', () => {
    const weekDays = getWorkWeekDays('2026-09-13', 'en');

    expect(getVisibleWeekDays(weekDays, 'all', '2026-09-17', 'en')).toEqual([{ date: '2026-09-17', label: 'Thursday' }]);
  });

  it('specific date overrides weekday filter', () => {
    const weekDays = getWorkWeekDays('2026-09-13', 'en');

    expect(getVisibleWeekDays(weekDays, 0, '2026-09-17', 'en')).toEqual([{ date: '2026-09-17', label: 'Thursday' }]);
  });

  it('clearing date on the current week returns to the current weekday', () => {
    const weekDays = getWorkWeekDays('2026-09-06', 'en');
    const nextFilter = getWeekdayFilterAfterClearingSpecificDate('2026-09-09', '2026-09-06');

    expect(nextFilter).toBe(3);
    expect(getVisibleWeekDays(weekDays, nextFilter, '', 'en')).toEqual([{ date: '2026-09-09', label: 'Wednesday' }]);
  });

  it('polling or rerender leaves a manual all-days filter intact', () => {
    const weekDays = getWorkWeekDays('2026-09-06', 'en');
    const manuallySelectedFilter: WeekdayFilter = 'all';

    expect(getVisibleWeekDays(weekDays, manuallySelectedFilter, '', 'en').map((day) => day.date)).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
    ]);
  });

  it('This week returns to the current weekday', () => {
    const currentWeekDays = getWorkWeekDays('2026-09-06', 'en');
    const thisWeekFilter = getDefaultWeekdayFilter('2026-09-09', '2026-09-06');

    expect(getVisibleWeekDays(currentWeekDays, thisWeekFilter, '', 'en')).toEqual([
      { date: '2026-09-09', label: 'Wednesday' },
    ]);
  });

  it('next and previous week preserve the selected weekday', () => {
    const selectedWeekday: WeekdayFilter = 3;

    expect(getVisibleWeekDays(getWorkWeekDays('2026-08-30', 'en'), selectedWeekday, '', 'en')).toEqual([
      { date: '2026-09-02', label: 'Wednesday' },
    ]);
    expect(getVisibleWeekDays(getWorkWeekDays('2026-09-13', 'en'), selectedWeekday, '', 'en')).toEqual([
      { date: '2026-09-16', label: 'Wednesday' },
    ]);
  });

  it('Action Center remains based on actual today, independent of week/date filters', () => {
    const data = buildFamilyActionCenterData({
      events: [event],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-08',
      currentTime: '12:00',
      language: 'en',
    });

    expect(data.today).toBe('2026-09-08');
    expect(data.remainingNonSchoolOccurrences[0]?.title).toBe('Practice');
  });

  it('English labels work', () => {
    expect(translations.en.weekdayFilter).toBe('Day of week');
    expect(translations.en.specificDateFilter).toBe('Specific date');
    expect(translations.en.clearDateFilter).toBe('Clear date filter');
    expect(translations.en.members).toBe('Members');
    expect(translations.en.activitiesFilter).toBe('Activities');
  });

  it('Hebrew labels work', () => {
    expect(translations.he.weekdayFilter.length).toBeGreaterThan(0);
    expect(translations.he.specificDateFilter.length).toBeGreaterThan(0);
    expect(translations.he.clearDateFilter.length).toBeGreaterThan(0);
    expect(translations.he.members.length).toBeGreaterThan(0);
    expect(translations.he.activitiesFilter.length).toBeGreaterThan(0);
  });

  it('supports multiple member selection', () => {
    const occurrences = [
      dashboardOccurrence('daniel-school', 'daniel', 'school', '2026-09-08'),
      dashboardOccurrence('emanuel-school', 'emanuel', 'school', '2026-09-08'),
      dashboardOccurrence('ido-school', 'ido', 'school', '2026-09-08'),
    ];

    expect(
      filterOccurrencesForDashboard(
        occurrences,
        { selectedMemberIds: ['daniel', 'emanuel'], selectedCategories: ['school'], selectedWeekdays: [2], specificDate: null },
        ['daniel', 'emanuel', 'ido'],
        ['school'],
      ).map((occurrence) => occurrence.childId),
    ).toEqual(['daniel', 'emanuel']);
  });

  it('matches a shared event when Daniel is selected', () => {
    const shared = dashboardOccurrence('shared', 'daniel', 'family', '2026-09-08', ['daniel', 'emanuel']);

    expect(
      filterOccurrencesForDashboard(
        [shared],
        { selectedMemberIds: ['daniel'], selectedCategories: ['family'], selectedWeekdays: [2], specificDate: null },
        ['daniel', 'emanuel'],
        ['family'],
      ).map((occurrence) => occurrence.eventId),
    ).toEqual(['shared']);
  });

  it('matches the same shared event when Emanuel is selected', () => {
    const shared = dashboardOccurrence('shared', 'daniel', 'family', '2026-09-08', ['daniel', 'emanuel']);

    expect(
      filterOccurrencesForDashboard(
        [shared],
        { selectedMemberIds: ['emanuel'], selectedCategories: ['family'], selectedWeekdays: [2], specificDate: null },
        ['daniel', 'emanuel'],
        ['family'],
      ).map((occurrence) => occurrence.eventId),
    ).toEqual(['shared']);
  });

  it('returns a shared event only once when two selected members match it', () => {
    const shared = dashboardOccurrence('shared', 'daniel', 'family', '2026-09-08', ['daniel', 'emanuel']);

    expect(
      filterOccurrencesForDashboard(
        [shared],
        { selectedMemberIds: ['daniel', 'emanuel'], selectedCategories: ['family'], selectedWeekdays: [2], specificDate: null },
        ['daniel', 'emanuel'],
        ['family'],
      ).map((occurrence) => occurrence.eventId),
    ).toEqual(['shared']);
  });

  it('hides a shared event when only an unrelated member is selected', () => {
    const shared = dashboardOccurrence('shared', 'daniel', 'family', '2026-09-08', ['daniel', 'emanuel']);

    expect(
      filterOccurrencesForDashboard(
        [shared],
        { selectedMemberIds: ['ido'], selectedCategories: ['family'], selectedWeekdays: [2], specificDate: null },
        ['daniel', 'emanuel', 'ido'],
        ['family'],
      ),
    ).toEqual([]);
  });

  it('supports multiple activity selection', () => {
    const occurrences = [
      dashboardOccurrence('school', 'daniel', 'school', '2026-09-08'),
      dashboardOccurrence('dance', 'daniel', 'dance', '2026-09-08'),
      dashboardOccurrence('doctor', 'daniel', 'doctor', '2026-09-08'),
    ];

    expect(
      filterOccurrencesForDashboard(
        occurrences,
        { selectedMemberIds: ['daniel'], selectedCategories: ['school', 'dance'], selectedWeekdays: [2], specificDate: null },
        ['daniel'],
        ['school', 'dance', 'doctor'],
      ).map((occurrence) => occurrence.category),
    ).toEqual(['school', 'dance']);
  });

  it('supports multiple weekday selection', () => {
    const weekDays = getWorkWeekDays('2026-09-06', 'en');

    expect(getVisibleWeekDaysForSelection(weekDays, [2, 3], null, 'en').map((day) => day.date)).toEqual([
      '2026-09-08',
      '2026-09-09',
    ]);
  });

  it('applies two members, two categories, and two days as an intersection', () => {
    const occurrences = [
      dashboardOccurrence('a', 'daniel', 'school', '2026-09-08'),
      dashboardOccurrence('b', 'emanuel', 'dance', '2026-09-09'),
      dashboardOccurrence('c', 'daniel', 'doctor', '2026-09-08'),
      dashboardOccurrence('d', 'ido', 'school', '2026-09-08'),
      dashboardOccurrence('e', 'emanuel', 'dance', '2026-09-10'),
    ];

    expect(
      filterOccurrencesForDashboard(
        occurrences,
        {
          selectedMemberIds: ['daniel', 'emanuel'],
          selectedCategories: ['school', 'dance'],
          selectedWeekdays: [2, 3],
          specificDate: null,
        },
        ['daniel', 'emanuel', 'ido'],
        ['school', 'dance', 'doctor'],
      ).map((occurrence) => occurrence.eventId),
    ).toEqual(['a', 'b']);
  });

  it('specific date overrides selected weekdays in dashboard filtering', () => {
    const occurrences = [
      dashboardOccurrence('tuesday', 'daniel', 'school', '2026-09-08'),
      dashboardOccurrence('thursday', 'daniel', 'school', '2026-09-10'),
    ];

    expect(
      filterOccurrencesForDashboard(
        occurrences,
        { selectedMemberIds: ['daniel'], selectedCategories: ['school'], selectedWeekdays: [2], specificDate: '2026-09-10' },
        ['daniel'],
        ['school'],
      ).map((occurrence) => occurrence.eventId),
    ).toEqual(['thursday']);
  });

  it('clearing a specific date restores the current weekday on the current week', () => {
    expect(getWeekdaysAfterClearingSpecificDate('2026-09-09', '2026-09-06', [2, 3])).toEqual([3]);
  });

  it('previous and next week preserve selected weekdays', () => {
    expect(getVisibleWeekDaysForSelection(getWorkWeekDays('2026-08-30', 'en'), [2, 3], null, 'en').map((day) => day.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
    ]);
    expect(getVisibleWeekDaysForSelection(getWorkWeekDays('2026-09-13', 'en'), [2, 3], null, 'en').map((day) => day.date)).toEqual([
      '2026-09-15',
      '2026-09-16',
    ]);
  });

  it('current week defaults to the current local weekday selection', () => {
    expect(getDefaultSelectedWeekdays('2026-09-09', '2026-09-06')).toEqual([3]);
  });

  it('reset returns to authorized members, authorized categories, current weekday, and no specific date', () => {
    expect(createResetFilterState('2026-09-09', '2026-09-06', ['daniel'], ['school', 'dance'])).toEqual({
      selectedMemberIds: ['daniel'],
      selectedCategories: ['school', 'dance'],
      selectedSystemTypes: ['holiday', 'school_vacation'],
      selectedWeekdays: [3],
      specificDate: null,
    });
  });

  it('permission refresh removes stale unauthorized selected members and categories', () => {
    const state: DashboardFilterState = {
      selectedMemberIds: ['daniel', 'emanuel'],
      selectedCategories: ['basketball', 'dance'],
      selectedSystemTypes: ['holiday'],
      selectedWeekdays: [2, 3],
      specificDate: null,
    };

    expect(sanitizeDashboardFilterState(state, ['emanuel'], ['dance'])).toEqual({
      selectedMemberIds: ['emanuel'],
      selectedCategories: ['dance'],
      selectedSystemTypes: ['holiday'],
      selectedWeekdays: [2, 3],
      specificDate: null,
    });
  });
});
