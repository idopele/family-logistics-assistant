import { children as seedChildren } from '../data/children';
import { eventExceptions as seedEventExceptions } from '../data/eventExceptions';
import { events as seedEvents } from '../data/events';
import type { Child, Event, EventException, EventReminder, PushSubscriptionRecord, ScheduleOccurrence } from '../models';
import { getOccurrencesForDate } from './scheduleEngine';
import { defaultFamilyTimeZone, getReminderTiming, type ReminderTiming } from './notificationTime';

export const maxPushDeliveryAttempts = 3;

export interface ReminderNotificationJob {
  reminder: EventReminder;
  occurrence: ScheduleOccurrence;
  child: Child;
  timing: ReminderTiming;
  notification: PushNotificationPayload;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export interface FamilyScheduleData {
  customChildren: Child[];
  customEvents: Event[];
  eventExceptions: EventException[];
  eventReminders: EventReminder[];
}

export function resolveDueReminderJobs({
  data,
  nowUtc,
  timeZone = defaultFamilyTimeZone,
  language = 'he',
}: {
  data: FamilyScheduleData;
  nowUtc: string;
  timeZone?: string;
  language?: 'he' | 'en';
}): ReminderNotificationJob[] {
  const children = [...seedChildren, ...data.customChildren].filter((child) => child.isActive);
  const childrenById = new Map(children.map((child) => [child.id, child]));
  const events = [...seedEvents, ...data.customEvents];
  const exceptions = [...seedEventExceptions, ...data.eventExceptions];

  return data.eventReminders.flatMap((reminder) => {
    if (!reminder.enabled) {
      return [];
    }

    const occurrence = getOccurrencesForDate(events, exceptions, reminder.occurrenceDate).find(
      (candidateOccurrence) => candidateOccurrence.eventId === reminder.eventId,
    );

    if (occurrence === undefined) {
      return [];
    }

    const child = childrenById.get(occurrence.childId);

    if (child === undefined) {
      return [];
    }

    const timing = getReminderTiming(occurrence, reminder.reminderMinutesBefore, nowUtc, timeZone);

    if (timing.state !== 'due') {
      return [];
    }

    return [
      {
        reminder,
        occurrence,
        child,
        timing,
        notification: buildReminderNotificationPayload(reminder, occurrence, child, language),
      },
    ];
  });
}

export function buildReminderNotificationPayload(
  reminder: Pick<EventReminder, 'id'>,
  occurrence: Pick<ScheduleOccurrence, 'eventId' | 'date' | 'title' | 'startTime' | 'location'>,
  child: Pick<Child, 'name'>,
  language: 'he' | 'en' = 'he',
): PushNotificationPayload {
  const searchParams = new URLSearchParams({ eventId: occurrence.eventId, date: occurrence.date });
  const locationSuffix = occurrence.location === null ? '' : ` · ${occurrence.location}`;

  return {
    title: `${child.name} – ${occurrence.title}`,
    body: language === 'he' ? `מתחיל ב-${occurrence.startTime}${locationSuffix}` : `Starts at ${occurrence.startTime}${locationSuffix}`,
    url: `/?${searchParams.toString()}`,
    tag: buildNotificationTag(reminder.id, occurrence.eventId, occurrence.date),
  };
}

export function buildNotificationTag(reminderId: string, eventId: string, occurrenceDate: string): string {
  return `${reminderId}:${eventId}:${occurrenceDate}`;
}

export function shouldRetryDelivery(attemptCount: number, isPermanentFailure: boolean): boolean {
  return !isPermanentFailure && attemptCount < maxPushDeliveryAttempts;
}

export function shouldDisableSubscriptionForStatus(status: number): boolean {
  return status === 404 || status === 410;
}

export function getEnabledSubscriptions(subscriptions: PushSubscriptionRecord[]): PushSubscriptionRecord[] {
  return subscriptions.filter((subscription) => subscription.enabled);
}
