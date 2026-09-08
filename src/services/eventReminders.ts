import type { Event, EventException, EventReminder, ScheduleOccurrence } from '../models';
import { translations, type Language } from '../i18n';
import { getOccurrencesForDate } from './scheduleEngine';
import { isValidDate } from '../utils/dateTime';

export const reminderMinuteOptions = [15, 30, 60, 120, 1440] as const;

export type ReminderMinutesBefore = (typeof reminderMinuteOptions)[number];

export function isReminderMinutesBefore(value: number): value is ReminderMinutesBefore {
  return reminderMinuteOptions.includes(value as ReminderMinutesBefore);
}

export function getReminderForOccurrence(
  reminders: EventReminder[],
  occurrence: Pick<ScheduleOccurrence, 'eventId' | 'date'>,
): EventReminder | null {
  return (
    reminders.find(
      (reminder) =>
        reminder.enabled && reminder.eventId === occurrence.eventId && reminder.occurrenceDate === occurrence.date,
    ) ?? null
  );
}

export function formatReminderLabel(minutesBefore: ReminderMinutesBefore, language: Language): string {
  const labels = translations[language];

  switch (minutesBefore) {
    case 15:
      return labels.reminder15Before;
    case 30:
      return labels.reminder30Before;
    case 60:
      return labels.reminder60Before;
    case 120:
      return labels.reminder120Before;
    case 1440:
      return labels.reminder1440Before;
  }
}

export function getReminderAccessibleLabel(reminder: EventReminder, language: Language): string {
  return `${translations[language].reminder} ${formatReminderLabel(reminder.reminderMinutesBefore, language)}`;
}

export function createEventReminder(
  eventId: string,
  occurrenceDate: string,
  reminderMinutesBefore: ReminderMinutesBefore,
  existingReminder: EventReminder | null = null,
  timestamp = new Date().toISOString(),
): EventReminder {
  return {
    id: existingReminder?.id ?? createReminderId(),
    eventId,
    occurrenceDate,
    reminderMinutesBefore,
    enabled: true,
    createdAt: existingReminder?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function parseEventDeepLink(search: string): { eventId: string; date: string } | null {
  const params = new URLSearchParams(search);
  const eventId = params.get('eventId');
  const date = params.get('date');

  if (eventId === null || eventId.trim() === '' || date === null || !isValidDate(date)) {
    return null;
  }

  return { eventId, date };
}

export function resolveDeepLinkedOccurrence(
  events: Event[],
  exceptions: EventException[],
  eventId: string,
  date: string,
): ScheduleOccurrence | null {
  if (eventId.trim() === '' || !isValidDate(date)) {
    return null;
  }

  return getOccurrencesForDate(events, exceptions, date).find((occurrence) => occurrence.eventId === eventId) ?? null;
}

export function removeEventDeepLinkParams(search: string): string {
  const params = new URLSearchParams(search);

  params.delete('eventId');
  params.delete('date');

  const nextSearch = params.toString();

  return nextSearch === '' ? '' : `?${nextSearch}`;
}

function createReminderId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `reminder-${crypto.randomUUID()}`;
  }

  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}