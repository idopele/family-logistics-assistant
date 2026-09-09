import type { EventReminder, ScheduleOccurrence } from '../models';
import { isValidDate, isValidTime, parseDateParts } from '../utils/dateTime';

export const defaultFamilyTimeZone = 'Asia/Jerusalem';

export type ReminderDueState = 'not-due' | 'due' | 'event-passed';

export interface ReminderTiming {
  eventStartUtc: string;
  scheduledForUtc: string;
  state: ReminderDueState;
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function getOccurrenceStartUtc(
  occurrence: Pick<ScheduleOccurrence, 'date' | 'startTime'>,
  timeZone = defaultFamilyTimeZone,
): string {
  return localDateTimeToUtc(occurrence.date, occurrence.startTime, timeZone);
}

export function getReminderScheduledUtc(
  occurrence: Pick<ScheduleOccurrence, 'date' | 'startTime'>,
  minutesBefore: EventReminder['reminderMinutesBefore'],
  timeZone = defaultFamilyTimeZone,
): string {
  const eventStartMs = Date.parse(getOccurrenceStartUtc(occurrence, timeZone));

  return new Date(eventStartMs - minutesBefore * 60_000).toISOString();
}

export function getReminderTiming(
  occurrence: Pick<ScheduleOccurrence, 'date' | 'startTime'>,
  minutesBefore: EventReminder['reminderMinutesBefore'],
  nowUtc: string,
  timeZone = defaultFamilyTimeZone,
): ReminderTiming {
  const eventStartUtc = getOccurrenceStartUtc(occurrence, timeZone);
  const scheduledForUtc = getReminderScheduledUtc(occurrence, minutesBefore, timeZone);
  const nowMs = Date.parse(nowUtc);
  const eventStartMs = Date.parse(eventStartUtc);
  const scheduledMs = Date.parse(scheduledForUtc);

  if (!Number.isFinite(nowMs)) {
    throw new Error(`Invalid UTC timestamp: ${nowUtc}`);
  }

  if (eventStartMs <= nowMs) {
    return { eventStartUtc, scheduledForUtc, state: 'event-passed' };
  }

  return { eventStartUtc, scheduledForUtc, state: scheduledMs <= nowMs ? 'due' : 'not-due' };
}

export function localDateTimeToUtc(date: string, time: string, timeZone: string): string {
  if (!isValidDate(date)) {
    throw new Error(`Invalid date: ${date}`);
  }

  if (!isValidTime(time)) {
    throw new Error(`Invalid time: ${time}`);
  }

  const { year, month, day } = parseDateParts(date);
  const [hourText, minuteText] = time.split(':');
  const localParts = {
    year,
    month,
    day,
    hour: Number(hourText),
    minute: Number(minuteText),
    second: 0,
  };
  let utcMs = Date.UTC(localParts.year, localParts.month - 1, localParts.day, localParts.hour, localParts.minute);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const zonedParts = getZonedDateParts(new Date(utcMs), timeZone);
    const representedLocalMs = Date.UTC(
      zonedParts.year,
      zonedParts.month - 1,
      zonedParts.day,
      zonedParts.hour,
      zonedParts.minute,
      zonedParts.second,
    );
    const expectedLocalMs = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second,
    );
    const offsetMs = representedLocalMs - utcMs;

    utcMs = expectedLocalMs - offsetMs;
  }

  const resolvedParts = getZonedDateParts(new Date(utcMs), timeZone);

  if (
    resolvedParts.year !== localParts.year ||
    resolvedParts.month !== localParts.month ||
    resolvedParts.day !== localParts.day ||
    resolvedParts.hour !== localParts.hour ||
    resolvedParts.minute !== localParts.minute
  ) {
    throw new Error(`Local time does not exist in ${timeZone}: ${date} ${time}`);
  }

  return new Date(utcMs).toISOString();
}

function getZonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}
