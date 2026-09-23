import type { Event, EventCategory, RecurrenceRule } from '../models';

export const customEventsStorageKey = 'family-logistics-custom-events-v1';

const eventCategories: EventCategory[] = [
  'school',
  'basketball',
  'dance',
  'privateLesson',
  'scouts',
  'doctor',
  'dentist',
  'haircut',
  'friends',
  'family',
  'work',
  'romanticDate',
  'meal',
  'birthday',
  'exam',
  'transportation',
  'parentMeeting',
  'performance',
  'openPractice',
  'other',
];

const parentMeetingTitles = ['אסיפת הורים', 'יום הורים'];

export function loadCustomEvents(): Event[] {
  const storage = getStorage();

  if (storage === null) {
    return [];
  }

  const rawValue = storage.getItem(customEventsStorageKey);

  if (rawValue === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    const storedEvents = parsedValue.filter(isStoredEvent);
    const migratedEvents = storedEvents.map(migrateStoredEvent);

    if (hasMigratedEvents(storedEvents, migratedEvents)) {
      saveCustomEvents(migratedEvents);
    }

    return migratedEvents;
  } catch {
    return [];
  }
}

export function saveCustomEvents(events: Event[]): void {
  const storage = getStorage();

  if (storage === null) {
    return;
  }

  storage.setItem(customEventsStorageKey, JSON.stringify(events));
}

export function updateCustomEvent(events: Event[], updatedEvent: Event): Event[] {
  return events.map((event) => (event.id === updatedEvent.id ? updatedEvent : event));
}

export function deleteCustomEvent(events: Event[], eventId: string): Event[] {
  return events.filter((event) => event.id !== eventId);
}

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function isStoredEvent(value: unknown): value is Event {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Partial<Event>;

  return (
    typeof event.id === 'string' &&
    (event.participantIds === undefined ||
      (Array.isArray(event.participantIds) && event.participantIds.length > 0 && event.participantIds.every((participantId) => typeof participantId === 'string' && participantId.trim() !== ''))) &&
    typeof event.childId === 'string' &&
    typeof event.title === 'string' &&
    isEventCategory(event.category) &&
    (typeof event.customCategoryLabel === 'string' || event.customCategoryLabel === null || event.customCategoryLabel === undefined) &&
    hasValidScheduleShape(event) &&
    typeof event.startTime === 'string' &&
    (typeof event.endTime === 'string' || event.endTime === null) &&
    (typeof event.endsNextDay === 'boolean' || event.endsNextDay === undefined) &&
    (typeof event.location === 'string' || event.location === null) &&
    (typeof event.notes === 'string' || event.notes === null) &&
    typeof event.requiresTransportation === 'boolean' &&
    (typeof event.pickupTime === 'string' || event.pickupTime === null) &&
    (typeof event.dropoffTime === 'string' || event.dropoffTime === null) &&
    typeof event.status === 'string' &&
    typeof event.createdAt === 'string' &&
    typeof event.updatedAt === 'string'
  );
}

function hasValidScheduleShape(event: Partial<Event>): boolean {
  const hasOneTimeDate = typeof event.date === 'string' && event.recurrence === null;
  const hasRecurrence = event.date === null && isRecurrenceRule(event.recurrence);

  return hasOneTimeDate || hasRecurrence;
}

function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const recurrence = value as Partial<RecurrenceRule>;

  return (
    (recurrence.frequency === 'daily' || recurrence.frequency === 'weekly' || recurrence.frequency === 'monthly') &&
    typeof recurrence.interval === 'number' &&
    Number.isInteger(recurrence.interval) &&
    recurrence.interval > 0 &&
    typeof recurrence.startDate === 'string' &&
    (typeof recurrence.endDate === 'string' || recurrence.endDate === null || recurrence.endDate === undefined) &&
    (recurrence.daysOfWeek === undefined ||
      (Array.isArray(recurrence.daysOfWeek) &&
        recurrence.daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
  );
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && eventCategories.includes(value as EventCategory);
}

function migrateStoredEvent(event: Event): Event {
  const eventWithOvernightFlag = {
    ...event,
    endsNextDay: event.endsNextDay ?? false,
    customCategoryLabel: event.customCategoryLabel ?? null,
  };

  if (eventWithOvernightFlag.category === 'other' && parentMeetingTitles.includes(eventWithOvernightFlag.title)) {
    return {
      ...eventWithOvernightFlag,
      category: 'parentMeeting',
    };
  }

  return eventWithOvernightFlag;
}

function hasMigratedEvents(originalEvents: Event[], migratedEvents: Event[]): boolean {
  return originalEvents.some(
    (event, index) =>
      event.category !== migratedEvents[index]?.category ||
      event.endsNextDay !== migratedEvents[index]?.endsNextDay ||
      event.customCategoryLabel !== migratedEvents[index]?.customCategoryLabel,
  );
}
