import { describe, expect, it } from 'vitest';
import { translations, weekDayLabelsByLanguage } from '../i18n';
import { buildFamilyActionCenterData } from '../services/familyActionCenter';
import type { Child, Event } from '../models';
import { getWorkWeekDays } from './week';
import { getVisibleWeekDays, getWeekStartForSpecificDate } from './scheduleViewFilters';

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

describe('schedule view date filters', () => {
  it('weekday filter shows the correct selected week day', () => {
    const weekDays = getWorkWeekDays('2026-09-06', 'en');

    expect(getVisibleWeekDays(weekDays, 2, '', 'en')).toEqual([{ date: '2026-09-08', label: 'Tuesday' }]);
  });

  it('preserves Sunday-Saturday weekday numbering', () => {
    expect(weekDayLabelsByLanguage.en[0]).toBe('Sunday');
    expect(weekDayLabelsByLanguage.en[6]).toBe('Saturday');
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

  it('clearing date returns normal week behavior', () => {
    const weekDays = getWorkWeekDays('2026-09-06', 'en');

    expect(getVisibleWeekDays(weekDays, 'all', '', 'en')).toHaveLength(7);
  });

  it('manual week navigation clears specific-date mode by returning to the selected week view', () => {
    const previousWeekDays = getWorkWeekDays('2026-09-06', 'en');

    expect(getVisibleWeekDays(previousWeekDays, 'all', '', 'en').map((day) => day.date)).toEqual([
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
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
  });

  it('Hebrew labels work', () => {
    expect(translations.he.weekdayFilter).toBe('יום בשבוע');
    expect(translations.he.specificDateFilter).toBe('תאריך מסוים');
    expect(translations.he.clearDateFilter).toBe('איפוס סינון תאריך');
  });
});
