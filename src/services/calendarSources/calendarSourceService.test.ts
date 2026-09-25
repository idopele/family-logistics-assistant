import { describe, expect, it } from 'vitest';
import { getDefaultCalendarSourceSettings, getSystemCalendarEventsForRange, filterSystemCalendarEventsForDashboard, normalizeCalendarSourceSettings } from './calendarSourceService';
import { getIsraelHolidayEvents } from './israelHolidays';
import { getMinistryEducationVacationEvents } from './ministryEducationVacations';
import { toPlainText } from './plainText';

describe('Israel holiday calendar source', () => {
  it('loads major and modern Israel holidays in Israel mode', () => {
    const events = getIsraelHolidayEvents({
      startDate: '2027-05-01',
      endDate: '2027-06-15',
      includeMinorObservances: false,
    });

    expect(events.some((event) => event.title.en === 'Yom HaShoah')).toBe(true);
    expect(events.some((event) => event.title.en === "Yom HaAtzma'ut")).toBe(true);
    expect(events.every((event) => event.metadata.israelMode)).toBe(true);
  });

  it('uses Israel rather than Diaspora behavior for Shavuot', () => {
    const events = getIsraelHolidayEvents({
      startDate: '2027-06-10',
      endDate: '2027-06-12',
      includeMinorObservances: false,
    });

    expect(events.filter((event) => event.title.en.includes('Shavuot'))).toHaveLength(1);
    expect(events.some((event) => event.startDate === '2027-06-12')).toBe(false);
  });

  it('excludes minor observances by default and includes them on request', () => {
    expect(getIsraelHolidayEvents({ startDate: '2027-01-23', endDate: '2027-01-23', includeMinorObservances: false })).toHaveLength(0);
    expect(getIsraelHolidayEvents({ startDate: '2027-01-23', endDate: '2027-01-23', includeMinorObservances: true })).toHaveLength(1);
  });

  it('keeps provider text plain', () => {
    expect(toPlainText('<script>alert(1)</script>Holiday')).toBe('alert(1)Holiday');
  });
});

describe('Ministry of Education vacation calendar source', () => {
  it('loads the 2026-2027 Jewish official middle-school profile as date ranges', () => {
    const events = getMinistryEducationVacationEvents({
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      schoolYear: '2026-2027',
      profile: { sector: 'jewish_official', level: 'middle_school' },
      studentParticipantIds: ['daniel', 'emanuel'],
    });

    expect(events.some((event) => event.title.en === 'Rosh Hashana vacation')).toBe(true);
    expect(events.some((event) => event.startDate === '2026-09-20' && event.endDate === '2026-10-03')).toBe(true);
    expect(events.every((event) => event.participantIds.join('|') === 'daniel|emanuel')).toBe(true);
  });

  it('does not duplicate one vacation event per participant', () => {
    const events = getMinistryEducationVacationEvents({
      startDate: '2026-12-06',
      endDate: '2026-12-12',
      schoolYear: '2026-2027',
      profile: { sector: 'jewish_official', level: 'middle_school' },
      studentParticipantIds: ['daniel', 'emanuel'],
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.participantIds).toEqual(['daniel', 'emanuel']);
  });

  it('requires an explicit matching education profile', () => {
    const events = getMinistryEducationVacationEvents({
      startDate: '2026-12-06',
      endDate: '2026-12-12',
      schoolYear: '2026-2027',
      profile: { sector: 'arab_official', level: 'middle_school' },
      studentParticipantIds: ['daniel'],
    });

    expect(events).toHaveLength(0);
  });
});

describe('calendar source resolution and filtering', () => {
  it('returns safe defaults and handles source disablement', () => {
    const settings = normalizeCalendarSourceSettings({
      israel_holidays: { enabled: false },
      moe_school_vacations: { enabled: false },
    });

    expect(settings.israel_holidays.enabled).toBe(false);
    expect(getSystemCalendarEventsForRange({
      settings,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      visibleParticipantIds: ['daniel'],
    })).toHaveLength(0);
  });

  it('shows holidays for any participant filter and school vacations only for relevant students', () => {
    const settings = getDefaultCalendarSourceSettings();
    const events = getSystemCalendarEventsForRange({
      settings,
      startDate: '2026-09-11',
      endDate: '2026-09-13',
      visibleParticipantIds: ['daniel', 'ido'],
    });

    expect(filterSystemCalendarEventsForDashboard({
      events,
      selectedMemberIds: ['ido'],
      selectedTypes: ['holiday', 'school_vacation'],
      selectedDates: ['2026-09-12'],
    }).map((event) => event.type)).toEqual(['holiday']);
    expect(filterSystemCalendarEventsForDashboard({
      events,
      selectedMemberIds: ['daniel'],
      selectedTypes: ['holiday', 'school_vacation'],
      selectedDates: ['2026-09-12'],
    }).map((event) => event.type).sort()).toEqual(['holiday', 'school_vacation']);
  });

  it('keeps overlapping holiday and vacation events separate and read-only', () => {
    const events = getSystemCalendarEventsForRange({
      settings: getDefaultCalendarSourceSettings(),
      startDate: '2026-09-12',
      endDate: '2026-09-12',
      visibleParticipantIds: ['daniel'],
    });

    expect(events.map((event) => event.type).sort()).toEqual(['holiday', 'school_vacation']);
    expect(events.every((event) => event.metadata.readOnly)).toBe(true);
  });
});
