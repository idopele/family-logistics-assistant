import { describe, expect, it } from 'vitest';

import { getReminderScheduledUtc, getReminderTiming, localDateTimeToUtc } from './notificationTime';

const occurrence = { date: '2026-09-09', startTime: '17:30' };

describe('notification time calculations', () => {
  it('calculates reminder UTC time for Asia/Jerusalem', () => {
    expect(localDateTimeToUtc('2026-09-09', '17:30', 'Asia/Jerusalem')).toBe('2026-09-09T14:30:00.000Z');
  });

  it('uses timezone data instead of a fixed offset for daylight saving changes', () => {
    expect(localDateTimeToUtc('2026-01-09', '17:30', 'Asia/Jerusalem')).toBe('2026-01-09T15:30:00.000Z');
    expect(localDateTimeToUtc('2026-07-09', '17:30', 'Asia/Jerusalem')).toBe('2026-07-09T14:30:00.000Z');
  });

  it('calculates a 15 minute reminder', () => {
    expect(getReminderScheduledUtc(occurrence, 15, 'Asia/Jerusalem')).toBe('2026-09-09T14:15:00.000Z');
  });

  it('calculates a 30 minute reminder', () => {
    expect(getReminderScheduledUtc(occurrence, 30, 'Asia/Jerusalem')).toBe('2026-09-09T14:00:00.000Z');
  });

  it('calculates a 60 minute reminder', () => {
    expect(getReminderScheduledUtc(occurrence, 60, 'Asia/Jerusalem')).toBe('2026-09-09T13:30:00.000Z');
  });

  it('calculates a 120 minute reminder', () => {
    expect(getReminderScheduledUtc(occurrence, 120, 'Asia/Jerusalem')).toBe('2026-09-09T12:30:00.000Z');
  });

  it('calculates a 1440 minute reminder', () => {
    expect(getReminderScheduledUtc(occurrence, 1440, 'Asia/Jerusalem')).toBe('2026-09-08T14:30:00.000Z');
  });

  it('classifies not-due, due, moved-earlier, and passed reminders', () => {
    expect(getReminderTiming(occurrence, 30, '2026-09-09T13:59:00.000Z', 'Asia/Jerusalem').state).toBe('not-due');
    expect(getReminderTiming(occurrence, 30, '2026-09-09T14:00:00.000Z', 'Asia/Jerusalem').state).toBe('due');
    expect(getReminderTiming(occurrence, 60, '2026-09-09T14:25:00.000Z', 'Asia/Jerusalem').state).toBe('due');
    expect(getReminderTiming(occurrence, 30, '2026-09-09T14:30:00.000Z', 'Asia/Jerusalem').state).toBe('event-passed');
  });
});
