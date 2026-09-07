import type { Event, EventCategory } from '../models';

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
    typeof event.childId === 'string' &&
    typeof event.title === 'string' &&
    isEventCategory(event.category) &&
    (typeof event.customCategoryLabel === 'string' || event.customCategoryLabel === null || event.customCategoryLabel === undefined) &&
    (typeof event.date === 'string' || event.date === null) &&
    typeof event.startTime === 'string' &&
    (typeof event.endTime === 'string' || event.endTime === null) &&
    (typeof event.endsNextDay === 'boolean' || event.endsNextDay === undefined) &&
    (typeof event.location === 'string' || event.location === null) &&
    (typeof event.notes === 'string' || event.notes === null) &&
    (typeof event.recurrence === 'object' || event.recurrence === null) &&
    typeof event.requiresTransportation === 'boolean' &&
    (typeof event.pickupTime === 'string' || event.pickupTime === null) &&
    (typeof event.dropoffTime === 'string' || event.dropoffTime === null) &&
    typeof event.status === 'string' &&
    typeof event.createdAt === 'string' &&
    typeof event.updatedAt === 'string'
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
