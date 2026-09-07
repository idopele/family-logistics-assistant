import type { Event, EventException, ScheduleOccurrence } from '../models';
import { addDays, compareDates, daysBetween, getDayOfWeek, isValidDate, monthsBetween, parseDateParts } from '../utils/dateTime';

export function getOccurrencesForDate(
  events: Event[],
  exceptions: EventException[],
  date: string,
): ScheduleOccurrence[] {
  assertValidDate(date, 'date');

  return events
    .flatMap((event) => resolveEventForDate(event, exceptions, date))
    .sort(compareOccurrences);
}

export function getOccurrencesForRange(
  events: Event[],
  exceptions: EventException[],
  startDate: string,
  endDate: string,
): ScheduleOccurrence[] {
  assertValidDate(startDate, 'startDate');
  assertValidDate(endDate, 'endDate');

  if (compareDates(endDate, startDate) < 0) {
    throw new Error('endDate must be the same as or later than startDate');
  }

  const occurrences: ScheduleOccurrence[] = [];
  const totalDays = daysBetween(startDate, endDate);

  for (let offset = 0; offset <= totalDays; offset += 1) {
    occurrences.push(...getOccurrencesForDate(events, exceptions, addDays(startDate, offset)));
  }

  return occurrences.sort(compareOccurrences);
}

function resolveEventForDate(event: Event, exceptions: EventException[], date: string): ScheduleOccurrence[] {
  if (event.status === 'cancelled' || !eventOccursOnDate(event, date)) {
    return [];
  }

  const exception = exceptions.find((candidate) => candidate.eventId === event.id && candidate.date === date);

  if (exception?.type === 'cancelled') {
    return [];
  }

  const occurrence = toOccurrence(event, date);

  if (exception?.type === 'modified') {
    return [applyException(occurrence, exception)];
  }

  return [occurrence];
}

function eventOccursOnDate(event: Event, date: string): boolean {
  if (event.recurrence === null) {
    return event.date === date;
  }

  const { recurrence } = event;

  if (compareDates(date, recurrence.startDate) < 0) {
    return false;
  }

  if (recurrence.endDate !== null && recurrence.endDate !== undefined && compareDates(date, recurrence.endDate) > 0) {
    return false;
  }

  if (recurrence.interval <= 0 || !Number.isInteger(recurrence.interval)) {
    return false;
  }

  switch (recurrence.frequency) {
    case 'daily':
      return daysBetween(recurrence.startDate, date) % recurrence.interval === 0;
    case 'weekly':
      return occursOnWeeklyRule(recurrence.startDate, recurrence.interval, recurrence.daysOfWeek, date);
    case 'monthly':
      return occursOnMonthlyRule(recurrence.startDate, recurrence.interval, date);
  }
}

function occursOnWeeklyRule(startDate: string, interval: number, daysOfWeek: number[] | undefined, date: string): boolean {
  const selectedDays = daysOfWeek ?? [getDayOfWeek(startDate)];

  if (!selectedDays.includes(getDayOfWeek(date))) {
    return false;
  }

  return Math.floor(daysBetween(startDate, date) / 7) % interval === 0;
}

function occursOnMonthlyRule(startDate: string, interval: number, date: string): boolean {
  const start = parseDateParts(startDate);
  const target = parseDateParts(date);
  const elapsedMonths = monthsBetween(startDate, date);

  return target.day === start.day && elapsedMonths >= 0 && elapsedMonths % interval === 0;
}

function toOccurrence(event: Event, date: string): ScheduleOccurrence {
  return {
    eventId: event.id,
    childId: event.childId,
    date,
    title: event.title,
    category: event.category,
    startTime: event.startTime,
    endTime: event.endTime,
    endsNextDay: event.endsNextDay,
    location: event.location,
    notes: event.notes,
    status: event.status,
    requiresTransportation: event.requiresTransportation,
    pickupTime: event.pickupTime,
    dropoffTime: event.dropoffTime,
    isException: false,
  };
}

function applyException(occurrence: ScheduleOccurrence, exception: EventException): ScheduleOccurrence {
  return {
    ...occurrence,
    startTime: exception.startTime ?? occurrence.startTime,
    endTime: exception.endTime === undefined ? occurrence.endTime : exception.endTime,
    location: exception.location === undefined ? occurrence.location : exception.location,
    notes: exception.notes === undefined ? occurrence.notes : exception.notes,
    isException: true,
  };
}

function compareOccurrences(first: ScheduleOccurrence, second: ScheduleOccurrence): number {
  return (
    first.date.localeCompare(second.date) ||
    first.startTime.localeCompare(second.startTime) ||
    first.childId.localeCompare(second.childId) ||
    first.eventId.localeCompare(second.eventId)
  );
}

function assertValidDate(value: string, fieldName: string): void {
  if (!isValidDate(value)) {
    throw new Error(`Invalid ${fieldName}: ${value}`);
  }
}
