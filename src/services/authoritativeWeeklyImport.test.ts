import { describe, expect, it } from 'vitest';
import type { Event, EventException } from '../models';
import { getOccurrencesForRange } from './scheduleEngine';
import { planAuthoritativeWeeklyBasketballReplacement } from './authoritativeWeeklyImport';

const weekStart = '2026-09-27';

describe('authoritative weekly basketball replacement planning', () => {
  it('replaces previous WhatsApp weekly events and preserves official games', () => {
    const plan = planAuthoritativeWeeklyBasketballReplacement({
      events: [
        oneTime('whatsapp-a', '2026-09-29', '18:00', 'אימון', 'whatsapp_weekly'),
        oneTime('official-a', '2026-09-29', '19:00', 'משחק רשמי', 'official_game_csv'),
      ],
      exceptions: [],
      targetMemberId: 'daniel',
      targetWeekStart: weekStart,
    });

    expect(plan.previousWeeklyEvents.map((event) => event.id)).toEqual(['whatsapp-a']);
    expect(plan.officialGameEvents.map((event) => event.id)).toEqual(['official-a']);
  });

  it('suppresses only selected-week recurring seed occurrences and leaves next week untouched', () => {
    const recurring = recurringBasketball('seed-recurring');
    const plan = planAuthoritativeWeeklyBasketballReplacement({
      events: [recurring],
      exceptions: [],
      targetMemberId: 'daniel',
      targetWeekStart: weekStart,
      suppressibleRecurringEventIds: new Set(['seed-recurring']),
    });

    expect(plan.recurringOccurrencesToSuppress).toEqual([{ eventId: 'seed-recurring', date: '2026-09-27' }]);
    expect(getOccurrencesForRange([recurring], plan.suppressionExceptionsToCreate, '2026-09-27', '2026-10-04').map((occurrence) => occurrence.date)).toEqual(['2026-10-04']);
  });

  it('does not duplicate seed suppression exceptions on re-import', () => {
    const existingException: EventException = {
      id: 'exception-seed-recurring-2026-09-27',
      eventId: 'seed-recurring',
      date: '2026-09-27',
      type: 'cancelled',
    };
    const plan = planAuthoritativeWeeklyBasketballReplacement({
      events: [recurringBasketball('seed-recurring')],
      exceptions: [existingException],
      targetMemberId: 'daniel',
      targetWeekStart: weekStart,
      suppressibleRecurringEventIds: new Set(['seed-recurring']),
    });

    expect(plan.suppressionExceptionsToCreate).toHaveLength(0);
  });

  it('keeps manual or unknown basketball events unless explicitly selected', () => {
    const manual = oneTime('manual-a', '2026-09-28', '17:00', 'Manual', null);
    const firstPlan = planAuthoritativeWeeklyBasketballReplacement({
      events: [manual],
      exceptions: [],
      targetMemberId: 'daniel',
      targetWeekStart: weekStart,
    });
    const selectedPlan = planAuthoritativeWeeklyBasketballReplacement({
      events: [manual],
      exceptions: [],
      targetMemberId: 'daniel',
      targetWeekStart: weekStart,
      manualRemovalEventIds: ['manual-a'],
    });

    expect(firstPlan.manualOrUnknownEvents).toHaveLength(1);
    expect(firstPlan.manualOrUnknownEventsToRemove).toHaveLength(0);
    expect(selectedPlan.manualOrUnknownEventsToRemove.map((event) => event.id)).toEqual(['manual-a']);
  });
});

function recurringBasketball(id: string): Event {
  return {
    ...baseEvent(id, null, '17:45', 'אימון כדורסל', null),
    recurrence: { frequency: 'weekly', interval: 1, startDate: '2026-09-01', daysOfWeek: [0] },
  };
}

function oneTime(
  id: string,
  date: string,
  startTime: string,
  title: string,
  source: 'whatsapp_weekly' | 'official_game_csv' | null,
): Event {
  return baseEvent(id, date, startTime, title, source);
}

function baseEvent(
  id: string,
  date: string | null,
  startTime: string,
  title: string,
  source: 'whatsapp_weekly' | 'official_game_csv' | null,
): Event {
  return {
    id,
    childId: 'daniel',
    participantIds: ['daniel'],
    title,
    category: 'basketball',
    customCategoryLabel: null,
    date,
    recurrence: null,
    startTime,
    endTime: null,
    endsNextDay: false,
    location: null,
    notes: source === null ? null : `csv_import:test\nimport_source:${source}`,
    requiresTransportation: false,
    pickupTime: null,
    dropoffTime: null,
    status: 'scheduled',
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
}
