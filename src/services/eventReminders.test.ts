import { describe, expect, it } from 'vitest';

import type { Event, EventException, EventReminder, ScheduleOccurrence } from '../models';
import { isEventReminder as isApiEventReminder } from '../../functions/api/sharedData';
import {
  buildEventDeepLinkUrl,
  createEventReminder,
  formatReminderLabel,
  getReminderAccessibleLabel,
  getReminderForOccurrence,
  isReminderMinutesBefore,
  parseEventDeepLink,
  removeEventDeepLinkParams,
  resolveDeepLinkedOccurrence,
  saveEventWithOptionalReminder,
} from './eventReminders';
import {
  deleteSharedEventReminderInState,
  parseSharedFamilyState,
  upsertSharedEventReminderInState,
} from './sharedFamilyData';
import { getOccurrencesForDate } from './scheduleEngine';

const timestamp = '2026-09-08T10:00:00.000Z';

const baseOneTimeEvent: Event = {
  id: 'custom-doctor-a',
  childId: 'daniel',
  title: 'Doctor',
  category: 'doctor',
  customCategoryLabel: null,
  date: '2026-09-08',
  startTime: '15:20',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: timestamp,
  updatedAt: timestamp,
};

const recurringEvent: Event = {
  ...baseOneTimeEvent,
  id: 'recurring-basketball-a',
  title: 'Basketball',
  category: 'basketball',
  date: null,
  startTime: '17:00',
  endTime: '18:00',
  recurrence: {
    frequency: 'weekly',
    interval: 1,
    startDate: '2026-09-01',
    daysOfWeek: [2],
  },
};

function reminderFor(eventId: string, occurrenceDate: string, minutes = 30): EventReminder {
  return createEventReminder(eventId, occurrenceDate, minutes as EventReminder['reminderMinutesBefore'], null, timestamp);
}

function occurrenceFor(event: Event, date = '2026-09-08'): ScheduleOccurrence {
  const occurrence = getOccurrencesForDate([event], [], date)[0];

  if (occurrence === undefined) {
    throw new Error('Expected test occurrence.');
  }

  return occurrence;
}

describe('event reminder foundations', () => {
  it('creates an enabled occurrence reminder with stable occurrence keys', () => {
    const reminder = createEventReminder('event-a', '2026-09-08', 15, null, timestamp);

    expect(reminder).toMatchObject({
      eventId: 'event-a',
      occurrenceDate: '2026-09-08',
      reminderMinutesBefore: 15,
      enabled: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it('updates an existing occurrence reminder without changing its id or createdAt', () => {
    const existing = createEventReminder('event-a', '2026-09-08', 15, null, timestamp);
    const updated = createEventReminder('event-a', '2026-09-08', 60, existing, '2026-09-08T11:00:00.000Z');

    expect(updated.id).toBe(existing.id);
    expect(updated.createdAt).toBe(timestamp);
    expect(updated.updatedAt).toBe('2026-09-08T11:00:00.000Z');
    expect(updated.reminderMinutesBefore).toBe(60);
  });

  it('removes a reminder from local shared state by event and occurrence date', () => {
    const reminder = reminderFor('event-a', '2026-09-08');

    expect(deleteSharedEventReminderInState([reminder], 'event-a', '2026-09-08')).toEqual([]);
  });

  it('survives shared data refresh parsing', () => {
    const reminder = reminderFor('event-a', '2026-09-08');

    expect(
      parseSharedFamilyState({
        customChildren: [],
        customEvents: [],
        eventExceptions: [],
        transportationPlans: [],
        eventReminders: [reminder],
        initialized: true,
      })?.eventReminders,
    ).toEqual([reminder]);
  });

  it('defaults missing reminder arrays from older shared responses to empty', () => {
    expect(
      parseSharedFamilyState({
        customChildren: [],
        customEvents: [],
        eventExceptions: [],
        transportationPlans: [],
        initialized: true,
      })?.eventReminders,
    ).toEqual([]);
  });

  it('matches a seeded event occurrence by event id and date', () => {
    const occurrence = occurrenceFor(baseOneTimeEvent);
    const reminder = reminderFor(occurrence.eventId, occurrence.date);

    expect(getReminderForOccurrence([reminder], occurrence)).toBe(reminder);
  });

  it('matches a custom one-time event occurrence by event id and date', () => {
    const customOccurrence = occurrenceFor({ ...baseOneTimeEvent, id: 'custom-family-meal' });
    const reminder = reminderFor(customOccurrence.eventId, customOccurrence.date, 120);

    expect(getReminderForOccurrence([reminder], customOccurrence)?.reminderMinutesBefore).toBe(120);
  });

  it('matches a recurring occurrence by event id and occurrence date', () => {
    const occurrence = occurrenceFor(recurringEvent);
    const reminder = reminderFor(recurringEvent.id, '2026-09-08');

    expect(getReminderForOccurrence([reminder], occurrence)).toBe(reminder);
  });

  it('does not share reminders across dates for the same recurring event', () => {
    const occurrence = occurrenceFor(recurringEvent, '2026-09-15');
    const reminder = reminderFor(recurringEvent.id, '2026-09-08');

    expect(getReminderForOccurrence([reminder], occurrence)).toBeNull();
  });

  it('continues to match a modified occurrence resolved through EventException', () => {
    const exception: EventException = {
      id: 'exception-recurring-basketball-a-2026-09-08',
      eventId: recurringEvent.id,
      date: '2026-09-08',
      type: 'modified',
      startTime: '18:30',
    };
    const occurrence = resolveDeepLinkedOccurrence([recurringEvent], [exception], recurringEvent.id, '2026-09-08');
    const reminder = reminderFor(recurringEvent.id, '2026-09-08');

    expect(occurrence?.startTime).toBe('18:30');
    expect(occurrence === null ? null : getReminderForOccurrence([reminder], occurrence)).toBe(reminder);
  });

  it('deep-links to an existing one-time occurrence', () => {
    expect(resolveDeepLinkedOccurrence([baseOneTimeEvent], [], baseOneTimeEvent.id, '2026-09-08')?.startTime).toBe('15:20');
  });

  it('deep-links to an existing recurring occurrence', () => {
    expect(resolveDeepLinkedOccurrence([recurringEvent], [], recurringEvent.id, '2026-09-08')?.title).toBe('Basketball');
  });

  it('does not resolve a cancelled occurrence deep link', () => {
    const exception: EventException = {
      id: 'cancel-recurring-basketball-a-2026-09-08',
      eventId: recurringEvent.id,
      date: '2026-09-08',
      type: 'cancelled',
    };

    expect(resolveDeepLinkedOccurrence([recurringEvent], [exception], recurringEvent.id, '2026-09-08')).toBeNull();
  });

  it('returns null for unknown or invalid deep links', () => {
    expect(parseEventDeepLink('?eventId=&date=2026-09-08')).toBeNull();
    expect(parseEventDeepLink('?eventId=event-a&date=2026-99-99')).toBeNull();
    expect(resolveDeepLinkedOccurrence([baseOneTimeEvent], [], 'missing', '2026-09-08')).toBeNull();
  });

  it('removes only event deep-link params while preserving unrelated params', () => {
    expect(removeEventDeepLinkParams('?eventId=event-a&date=2026-09-08&theme=dark')).toBe('?theme=dark');
  });

  it('upserts duplicate reminders by event and occurrence date', () => {
    const first = reminderFor('event-a', '2026-09-08', 15);
    const second = { ...reminderFor('event-a', '2026-09-08', 60), id: 'replacement' };

    expect(upsertSharedEventReminderInState([first], second)).toEqual([second]);
  });

  it('renders localized reminder labels and accessible labels', () => {
    const reminder = reminderFor('event-a', '2026-09-08', 1440);

    expect(formatReminderLabel(1440, 'en')).toBe('1 day before');
    expect(formatReminderLabel(60, 'he')).toBe('שעה לפני');
    expect(getReminderAccessibleLabel(reminder, 'en')).toBe('Reminder 1 day before');
  });

  it('validates allowed reminder minute offsets', () => {
    expect(isReminderMinutesBefore(30)).toBe(true);
    expect(isReminderMinutesBefore(10)).toBe(false);
    expect(isApiEventReminder({ ...reminderFor('event-a', '2026-09-08'), reminderMinutesBefore: 10 })).toBe(false);
  });


  it('builds copied event links with the current origin and occurrence params', () => {
    const occurrence = occurrenceFor(baseOneTimeEvent);
    const link = buildEventDeepLinkUrl(occurrence, 'https://family.example.test');
    const url = new URL(link);

    expect(url.origin).toBe('https://family.example.test');
    expect(url.hostname).not.toBe('family-logistics-assistant.pages.dev');
    expect(url.searchParams.get('eventId')).toBe(baseOneTimeEvent.id);
    expect(url.searchParams.get('date')).toBe('2026-09-08');
  });

  it('copied links reopen the exact resolved occurrence', () => {
    const link = buildEventDeepLinkUrl(occurrenceFor(baseOneTimeEvent), 'https://family.example.test');
    const parsed = parseEventDeepLink(new URL(link).search);

    expect(parsed).not.toBeNull();
    expect(parsed === null ? null : resolveDeepLinkedOccurrence([baseOneTimeEvent], [], parsed.eventId, parsed.date)?.eventId).toBe(
      baseOneTimeEvent.id,
    );
  });

  it('creates no reminder when no reminder is selected during event creation', async () => {
    const savedReminders: EventReminder[] = [];
    const result = await saveEventWithOptionalReminder({
      event: baseOneTimeEvent,
      reminderMinutesBefore: null,
      saveEvent: async () => true,
      saveReminder: async (reminder) => {
        savedReminders.push(reminder);
        return true;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.reminder).toBeNull();
    expect(savedReminders).toEqual([]);
  });

  it('creates a one-time event reminder for the event date', async () => {
    const result = await saveEventWithOptionalReminder({
      event: baseOneTimeEvent,
      reminderMinutesBefore: 30,
      saveEvent: async () => true,
      saveReminder: async () => true,
    });

    expect(result.ok).toBe(true);
    expect(result.reminder).toMatchObject({
      eventId: baseOneTimeEvent.id,
      occurrenceDate: '2026-09-08',
      reminderMinutesBefore: 30,
    });
  });

  it('creates a recurring event reminder for the first occurrence only', async () => {
    const result = await saveEventWithOptionalReminder({
      event: recurringEvent,
      reminderMinutesBefore: 60,
      saveEvent: async () => true,
      saveReminder: async () => true,
    });

    expect(result.ok).toBe(true);
    expect(result.reminder?.occurrenceDate).toBe('2026-09-01');
  });

  it('does not create a reminder when event creation fails', async () => {
    let didTryReminder = false;
    const result = await saveEventWithOptionalReminder({
      event: baseOneTimeEvent,
      reminderMinutesBefore: 30,
      saveEvent: async () => false,
      saveReminder: async () => {
        didTryReminder = true;
        return true;
      },
    });

    expect(result).toMatchObject({ ok: false, event: null, reminder: null, reminderSaveFailed: false });
    expect(didTryReminder).toBe(false);
  });

  it('keeps the created event when reminder creation fails so retry does not need a new event', async () => {
    let eventSaveCount = 0;
    const result = await saveEventWithOptionalReminder({
      event: baseOneTimeEvent,
      reminderMinutesBefore: 30,
      saveEvent: async () => {
        eventSaveCount += 1;
        return true;
      },
      saveReminder: async () => false,
    });

    expect(eventSaveCount).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.event?.id).toBe(baseOneTimeEvent.id);
    expect(result.reminderSaveFailed).toBe(true);
  });
  it('ignores disabled reminders when matching an occurrence', () => {
    const occurrence = occurrenceFor(baseOneTimeEvent);
    const disabledReminder = { ...reminderFor(occurrence.eventId, occurrence.date), enabled: false };

    expect(getReminderForOccurrence([disabledReminder], occurrence)).toBeNull();
  });
});