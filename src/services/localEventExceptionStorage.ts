import type { EventException } from '../models';

export const customEventExceptionsStorageKey = 'family-logistics-custom-event-exceptions-v1';

export function loadCustomEventExceptions(): EventException[] {
  const storage = getStorage();

  if (storage === null) {
    return [];
  }

  const rawValue = storage.getItem(customEventExceptionsStorageKey);

  if (rawValue === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isStoredEventException);
  } catch {
    return [];
  }
}

export function saveCustomEventExceptions(exceptions: EventException[]): void {
  const storage = getStorage();

  if (storage === null) {
    return;
  }

  storage.setItem(customEventExceptionsStorageKey, JSON.stringify(exceptions));
}

export function upsertCustomEventException(exceptions: EventException[], nextException: EventException): EventException[] {
  const existingIndex = exceptions.findIndex(
    (exception) => exception.eventId === nextException.eventId && exception.date === nextException.date,
  );

  if (existingIndex === -1) {
    return [...exceptions, nextException];
  }

  return exceptions.map((exception, index) => (index === existingIndex ? nextException : exception));
}

export function deleteCustomEventExceptionsForEvent(exceptions: EventException[], eventId: string): EventException[] {
  return exceptions.filter((exception) => exception.eventId !== eventId);
}

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function isStoredEventException(value: unknown): value is EventException {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const exception = value as Partial<EventException>;

  return (
    typeof exception.id === 'string' &&
    typeof exception.eventId === 'string' &&
    typeof exception.date === 'string' &&
    (exception.type === 'cancelled' || exception.type === 'modified') &&
    (typeof exception.title === 'string' || exception.title === undefined) &&
    (typeof exception.startTime === 'string' || exception.startTime === undefined) &&
    (typeof exception.endTime === 'string' || exception.endTime === null || exception.endTime === undefined) &&
    (typeof exception.endsNextDay === 'boolean' || exception.endsNextDay === undefined) &&
    (typeof exception.location === 'string' || exception.location === null || exception.location === undefined) &&
    (typeof exception.notes === 'string' || exception.notes === null || exception.notes === undefined)
  );
}
