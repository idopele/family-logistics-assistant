import type { Event, EventException } from '../models';
import { addDays } from '../utils/dateTime';
import { getOccurrencesForRange } from './scheduleEngine';
import { isImportedFromSource } from './scheduleImport';

export interface AuthoritativeWeeklyReplacementPlan {
  weekEndDate: string;
  previousWeeklyEvents: Event[];
  officialGameEvents: Event[];
  manualOrUnknownEvents: Event[];
  manualOrUnknownEventsToRemove: Event[];
  recurringOccurrencesToSuppress: Array<{ eventId: string; date: string }>;
  suppressionExceptionsToCreate: EventException[];
}

export function planAuthoritativeWeeklyBasketballReplacement({
  events,
  exceptions,
  targetMemberId,
  targetWeekStart,
  manualRemovalEventIds = [],
  suppressibleRecurringEventIds,
}: {
  events: Event[];
  exceptions: EventException[];
  targetMemberId: string;
  targetWeekStart: string;
  manualRemovalEventIds?: string[];
  suppressibleRecurringEventIds?: Set<string>;
}): AuthoritativeWeeklyReplacementPlan {
  const weekEndDate = addDays(targetWeekStart, 6);
  const manualRemovalIdSet = new Set(manualRemovalEventIds);
  const oneTimeBasketballEventsInWeek = events.filter((event) =>
    event.childId === targetMemberId &&
    event.category === 'basketball' &&
    event.recurrence === null &&
    event.date !== null &&
    event.date >= targetWeekStart &&
    event.date <= weekEndDate
  );
  const previousWeeklyEvents = oneTimeBasketballEventsInWeek.filter((event) => isImportedFromSource(event, 'whatsapp_weekly'));
  const officialGameEvents = oneTimeBasketballEventsInWeek.filter((event) => isImportedFromSource(event, 'official_game_csv'));
  const manualOrUnknownEvents = oneTimeBasketballEventsInWeek.filter((event) =>
    !isImportedFromSource(event, 'whatsapp_weekly') &&
    !isImportedFromSource(event, 'official_game_csv')
  );
  const recurringOccurrencesToSuppress = getOccurrencesForRange(events, exceptions, targetWeekStart, weekEndDate)
    .filter((occurrence) =>
      occurrence.childId === targetMemberId &&
      occurrence.category === 'basketball' &&
      events.some((event) =>
        event.id === occurrence.eventId &&
        event.recurrence !== null &&
        (suppressibleRecurringEventIds === undefined || suppressibleRecurringEventIds.has(event.id))
      )
    )
    .map((occurrence) => ({ eventId: occurrence.eventId, date: occurrence.date }));
  const existingExceptionKeys = new Set(exceptions.map((exception) => `${exception.eventId}|${exception.date}`));
  const suppressionExceptionsToCreate = recurringOccurrencesToSuppress
    .filter((occurrence) => !existingExceptionKeys.has(`${occurrence.eventId}|${occurrence.date}`))
    .map((occurrence): EventException => ({
      id: `exception-${occurrence.eventId}-${occurrence.date}`,
      eventId: occurrence.eventId,
      date: occurrence.date,
      type: 'cancelled',
    }));

  return {
    weekEndDate,
    previousWeeklyEvents,
    officialGameEvents,
    manualOrUnknownEvents,
    manualOrUnknownEventsToRemove: manualOrUnknownEvents.filter((event) => manualRemovalIdSet.has(event.id)),
    recurringOccurrencesToSuppress,
    suppressionExceptionsToCreate,
  };
}
