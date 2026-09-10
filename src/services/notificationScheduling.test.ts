import { describe, expect, it } from 'vitest';

import type { Child, Event, EventException, EventReminder } from '../models';
import {
  buildNotificationTag,
  buildReminderNotificationPayload,
  getEnabledSubscriptions,
  resolveDueReminderJobs,
  shouldDisableSubscriptionForStatus,
  shouldRetryDelivery,
} from './notificationScheduling';

const child: Child = { id: 'test-child', name: 'Emanuel', color: '#123456', isActive: true };
const event: Event = {
  id: 'test-event',
  childId: child.id,
  title: 'Ballet',
  category: 'dance',
  customCategoryLabel: null,
  date: '2026-09-09',
  startTime: '17:30',
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
const reminder: EventReminder = {
  id: 'reminder-test',
  eventId: event.id,
  occurrenceDate: event.date ?? '',
  reminderMinutesBefore: 30,
  enabled: true,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};
const scheduledForUtc = '2026-09-09T14:00:00.000Z';

describe('notification scheduling', () => {
  it('selects due reminders and ignores reminders that are not due', () => {
    expect(buildJobs('2026-09-09T13:59:00.000Z')).toHaveLength(0);
    expect(buildJobs('2026-09-09T14:00:00.000Z')).toHaveLength(1);
  });

  it('skips already-passed events', () => {
    expect(buildJobs('2026-09-09T14:30:00.000Z')).toHaveLength(0);
  });

  it('skips cancelled occurrences', () => {
    const exception: EventException = {
      id: 'exception-test',
      eventId: event.id,
      date: '2026-09-09',
      type: 'cancelled',
    };

    expect(buildJobs('2026-09-09T14:00:00.000Z', { exceptions: [exception] })).toHaveLength(0);
  });

  it('skips disabled reminders', () => {
    expect(buildJobs('2026-09-09T14:00:00.000Z', { reminders: [{ ...reminder, enabled: false }] })).toHaveLength(0);
  });

  it('recalculates when an event occurrence time changes', () => {
    const exception: EventException = {
      id: 'exception-test',
      eventId: event.id,
      date: '2026-09-09',
      type: 'modified',
      startTime: '18:30',
    };

    expect(buildJobs('2026-09-09T14:00:00.000Z', { exceptions: [exception] })).toHaveLength(0);
    expect(buildJobs('2026-09-09T15:00:00.000Z', { exceptions: [exception] })).toHaveLength(1);
  });

  it('recalculates when the reminder offset changes', () => {
    expect(buildJobs('2026-09-09T13:30:00.000Z', { reminders: [{ ...reminder, reminderMinutesBefore: 60 }] })).toHaveLength(1);
  });

  it('sends moved-earlier-but-future reminders as soon as practical', () => {
    const exception: EventException = {
      id: 'exception-test',
      eventId: event.id,
      date: '2026-09-09',
      type: 'modified',
      startTime: '17:00',
    };

    expect(buildJobs('2026-09-09T13:45:00.000Z', { exceptions: [exception] })).toHaveLength(1);
  });

  it('builds compact notification content, occurrence deep links, and stable tags', () => {
    const payload = buildReminderNotificationPayload(
      reminder,
      { ...event, eventId: event.id, date: '2026-09-09' },
      child,
      scheduledForUtc,
      'en',
    );

    expect(payload.title).toBe('Emanuel – Ballet');
    expect(payload.body).toBe('Starts at 17:30');
    expect(payload.url).toBe('/?eventId=test-event&date=2026-09-09');
    expect(payload.tag).toBe(buildNotificationTag(reminder.id, event.id, '2026-09-09', scheduledForUtc));
    expect(payload.renotify).toBe(true);
  });

  it('keeps the same real reminder tag for retries of the same scheduled delivery', () => {
    const firstTag = buildNotificationTag(reminder.id, event.id, '2026-09-09', scheduledForUtc);
    const retryTag = buildNotificationTag(reminder.id, event.id, '2026-09-09', scheduledForUtc);

    expect(firstTag).toBe(retryTag);
    expect(firstTag).toMatch(/^family-reminder-[a-f0-9]{8}$/);
  });

  it('changes the real reminder tag when a reschedule changes scheduledForUtc', () => {
    const originalTag = buildNotificationTag(reminder.id, event.id, '2026-09-09', scheduledForUtc);
    const rescheduledTag = buildNotificationTag(
      reminder.id,
      event.id,
      '2026-09-09',
      '2026-09-09T15:00:00.000Z',
    );

    expect(rescheduledTag).not.toBe(originalTag);
  });

  it('uses the resolved scheduledForUtc in due reminder payload tags', () => {
    const originalJob = buildJobs(scheduledForUtc)[0];
    const exception: EventException = {
      id: 'exception-rescheduled',
      eventId: event.id,
      date: '2026-09-09',
      type: 'modified',
      startTime: '18:30',
    };
    const rescheduledJob = buildJobs('2026-09-09T15:00:00.000Z', { exceptions: [exception] })[0];

    expect(originalJob?.notification.url).toBe('/?eventId=test-event&date=2026-09-09');
    expect(rescheduledJob?.notification.url).toBe('/?eventId=test-event&date=2026-09-09');
    expect(rescheduledJob?.notification.tag).not.toBe(originalJob?.notification.tag);
    expect(rescheduledJob?.notification.tag).toBe(
      buildNotificationTag(reminder.id, event.id, '2026-09-09', '2026-09-09T15:00:00.000Z'),
    );
  });

  it('filters enabled subscriptions and classifies retryable failures', () => {
    expect(
      getEnabledSubscriptions([
        subscription('one', true),
        subscription('two', false),
      ]).map((item) => item.id),
    ).toEqual(['one']);
    expect(shouldDisableSubscriptionForStatus(410)).toBe(true);
    expect(shouldRetryDelivery(2, false)).toBe(true);
    expect(shouldRetryDelivery(3, false)).toBe(false);
    expect(shouldRetryDelivery(1, true)).toBe(false);
  });
});

function buildJobs(
  nowUtc: string,
  overrides: { exceptions?: EventException[]; reminders?: EventReminder[] } = {},
) {
  return resolveDueReminderJobs({
    data: {
      customChildren: [child],
      customEvents: [event],
      eventExceptions: overrides.exceptions ?? [],
      eventReminders: overrides.reminders ?? [reminder],
    },
    nowUtc,
    timeZone: 'Asia/Jerusalem',
    language: 'en',
  });
}

function subscription(id: string, enabled: boolean) {
  return {
    id,
    endpoint: `https://push.example.test/${id}`,
    p256dh: 'key',
    auth: 'auth',
    enabled,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    failureCount: 0,
  };
}
