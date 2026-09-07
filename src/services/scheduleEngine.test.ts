import { describe, expect, it } from 'vitest';
import { eventExceptions } from '../data/eventExceptions';
import { events as seedEvents } from '../data/events';
import type { Event, EventException } from '../models';
import type { TransportationPlan } from '../models';
import {
  deleteTransportationPlansForEvent,
  getTransportationPlanForScheduleOccurrence,
} from './localTransportationStorage';
import { getOccurrencesForDate, getOccurrencesForRange } from './scheduleEngine';

const baseEvent: Event = {
  id: 'event-a',
  childId: 'child-a',
  title: 'School',
  category: 'school',
  customCategoryLabel: null,
  date: '2026-09-07',
  startTime: '08:00',
  endTime: '13:00',
  endsNextDay: false,
  location: 'School',
  notes: 'Bring bag',
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    ...baseEvent,
    ...overrides,
  };
}

function makeException(overrides: Partial<EventException> = {}): EventException {
  return {
    id: 'exception-a',
    eventId: 'event-a',
    date: '2026-09-14',
    type: 'modified',
    ...overrides,
  };
}

function makeTransportationPlan(overrides: Partial<TransportationPlan> = {}): TransportationPlan {
  return {
    id: 'transport-a',
    eventId: 'event-a',
    occurrenceDate: '2026-09-14',
    outbound: {
      enabled: true,
      driverName: 'אבא',
      time: '16:50',
      occursNextDay: false,
      from: null,
      to: 'Gym',
      passengerChildIds: ['child-a'],
      additionalPassengers: null,
      notes: null,
    },
    returnTrip: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('scheduleEngine', () => {
  it('includes a one-time event on its date', () => {
    const occurrences = getOccurrencesForDate([makeEvent()], [], '2026-09-07');

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.eventId).toBe('event-a');
    expect(occurrences[0]?.isException).toBe(false);
  });

  it('includes a one-time event inside a range alongside recurring events', () => {
    const recurringEvent = makeEvent({
      id: 'recurring-a',
      date: null,
      recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [2], startDate: '2026-09-06' },
    });
    const oneTimeEvent = makeEvent({
      id: 'doctor-a',
      title: 'Doctor',
      category: 'doctor',
      customCategoryLabel: null,
      date: '2026-09-08',
      startTime: '15:20',
      endTime: null,
      recurrence: null,
    });

    const occurrences = getOccurrencesForRange([recurringEvent, oneTimeEvent], [], '2026-09-06', '2026-09-12');

    expect(occurrences.map((occurrence) => occurrence.eventId)).toEqual(['recurring-a', 'doctor-a']);
    expect(occurrences[1]).toMatchObject({
      eventId: 'doctor-a',
      date: '2026-09-08',
      startTime: '15:20',
      endTime: null,
    });
  });

  it('preserves endsNextDay in schedule occurrences', () => {
    const overnightEvent = makeEvent({
      date: '2026-09-12',
      startTime: '23:00',
      endTime: '01:00',
      endsNextDay: true,
    });

    expect(getOccurrencesForDate([overnightEvent], [], '2026-09-12')[0]?.endsNextDay).toBe(true);
  });

  it('preserves customCategoryLabel in schedule occurrences', () => {
    const customTypeEvent = makeEvent({
      category: 'other',
      customCategoryLabel: 'טיפול',
    });

    expect(getOccurrencesForDate([customTypeEvent], [], '2026-09-07')[0]?.customCategoryLabel).toBe('טיפול');
  });

  it('returns Daniel doctor seed event through range resolution', () => {
    const occurrences = getOccurrencesForRange(seedEvents, eventExceptions, '2026-09-06', '2026-09-12');
    const doctorOccurrence = occurrences.find((occurrence) => occurrence.eventId === 'daniel-doctor-20260908-1520');

    expect(doctorOccurrence).toMatchObject({
      childId: 'daniel',
      date: '2026-09-08',
      startTime: '15:20',
      endTime: null,
      title: 'בדיקת רופאה',
      category: 'doctor',
      customCategoryLabel: null,
      location: null,
      notes: null,
    });
  });

  it('excludes a one-time event on another date', () => {
    expect(getOccurrencesForDate([makeEvent()], [], '2026-09-08')).toEqual([]);
  });

  it('resolves a weekly recurring event', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1], startDate: '2026-09-07' },
    });

    expect(getOccurrencesForRange([event], [], '2026-09-07', '2026-09-21').map((occurrence) => occurrence.date)).toEqual([
      '2026-09-07',
      '2026-09-14',
      '2026-09-21',
    ]);
  });

  it('resolves an every-second-week recurrence relative to the start week', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'weekly', interval: 2, daysOfWeek: [1], startDate: '2026-09-07' },
    });

    expect(getOccurrencesForRange([event], [], '2026-09-07', '2026-10-05').map((occurrence) => occurrence.date)).toEqual([
      '2026-09-07',
      '2026-09-21',
      '2026-10-05',
    ]);
  });

  it('resolves a daily recurrence with interval greater than 1', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 3, startDate: '2026-09-07' },
    });

    expect(getOccurrencesForRange([event], [], '2026-09-07', '2026-09-16').map((occurrence) => occurrence.date)).toEqual([
      '2026-09-07',
      '2026-09-10',
      '2026-09-13',
      '2026-09-16',
    ]);
  });

  it('resolves a monthly recurrence on the same day of month', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'monthly', interval: 1, startDate: '2026-01-15' },
    });

    expect(getOccurrencesForRange([event], [], '2026-01-01', '2026-04-30').map((occurrence) => occurrence.date)).toEqual([
      '2026-01-15',
      '2026-02-15',
      '2026-03-15',
      '2026-04-15',
    ]);
  });

  it('skips February for a monthly recurrence that starts on the 31st', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'monthly', interval: 1, startDate: '2026-01-31' },
    });

    expect(getOccurrencesForRange([event], [], '2026-01-01', '2026-03-31').map((occurrence) => occurrence.date)).toEqual([
      '2026-01-31',
      '2026-03-31',
    ]);
  });

  it('includes the recurrence startDate boundary', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-07' },
    });

    expect(getOccurrencesForDate([event], [], '2026-09-07')).toHaveLength(1);
    expect(getOccurrencesForDate([event], [], '2026-09-06')).toHaveLength(0);
  });

  it('includes the recurrence endDate boundary', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-07', endDate: '2026-09-09' },
    });

    expect(getOccurrencesForRange([event], [], '2026-09-07', '2026-09-10').map((occurrence) => occurrence.date)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
    ]);
  });

  it('removes only one occurrence for a cancelled exception', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-13', endDate: '2026-09-15' },
    });
    const exception = makeException({ type: 'cancelled', date: '2026-09-14' });

    expect(getOccurrencesForRange([event], [exception], '2026-09-13', '2026-09-15').map((occurrence) => occurrence.date)).toEqual([
      '2026-09-13',
      '2026-09-15',
    ]);
  });

  it('changes only one occurrence for a modified exception', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-13', endDate: '2026-09-15' },
    });
    const exception = makeException({ date: '2026-09-14', startTime: '09:30', location: 'Library' });
    const occurrences = getOccurrencesForRange([event], [exception], '2026-09-13', '2026-09-15');

    expect(occurrences.map((occurrence) => occurrence.startTime)).toEqual(['08:00', '09:30', '08:00']);
    expect(occurrences[1]?.location).toBe('Library');
    expect(occurrences[1]?.isException).toBe(true);
    expect(occurrences[0]?.isException).toBe(false);
    expect(occurrences[2]?.isException).toBe(false);
  });

  it('allows a modified exception to clear endTime', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-14' },
    });
    const exception = makeException({ date: '2026-09-14', endTime: null });

    expect(getOccurrencesForDate([event], [exception], '2026-09-14')[0]?.endTime).toBeNull();
  });

  it('applies title and endsNextDay overrides to only one occurrence', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-13', endDate: '2026-09-15' },
      endTime: '10:00',
    });
    const exception = makeException({
      date: '2026-09-14',
      title: 'Updated title',
      startTime: '23:00',
      endTime: '01:00',
      endsNextDay: true,
    });
    const occurrences = getOccurrencesForRange([event], [exception], '2026-09-13', '2026-09-15');

    expect(occurrences[1]).toMatchObject({
      title: 'Updated title',
      startTime: '23:00',
      endTime: '01:00',
      endsNextDay: true,
      isException: true,
    });
    expect(occurrences[0]).toMatchObject({ title: 'School', endsNextDay: false, isException: false });
    expect(occurrences[2]).toMatchObject({ title: 'School', endsNextDay: false, isException: false });
  });

  it('sorts multiple children and events deterministically', () => {
    const events = [
      makeEvent({ id: 'event-b', childId: 'child-b', startTime: '08:00' }),
      makeEvent({ id: 'event-a', childId: 'child-b', startTime: '08:00' }),
      makeEvent({ id: 'event-c', childId: 'child-a', startTime: '08:00' }),
      makeEvent({ id: 'event-d', childId: 'child-a', startTime: '07:30' }),
    ];

    expect(getOccurrencesForDate(events, [], '2026-09-07').map((occurrence) => occurrence.eventId)).toEqual([
      'event-d',
      'event-c',
      'event-a',
      'event-b',
    ]);
  });

  it('ignores events with cancelled status', () => {
    expect(getOccurrencesForDate([makeEvent({ status: 'cancelled' })], [], '2026-09-07')).toEqual([]);
  });

  it('throws for invalid date input', () => {
    expect(() => getOccurrencesForDate([makeEvent()], [], '2026-02-30')).toThrow();
    expect(() => getOccurrencesForRange([makeEvent()], [], 'not-a-date', '2026-09-07')).toThrow();
  });

  it('throws when a range endDate is earlier than startDate', () => {
    expect(() => getOccurrencesForRange([makeEvent()], [], '2026-09-08', '2026-09-07')).toThrow();
  });

  it('links a one-time event occurrence to its transportation plan', () => {
    const occurrence = getOccurrencesForDate([makeEvent({ date: '2026-09-08' })], [], '2026-09-08')[0];
    const plan = makeTransportationPlan({ eventId: 'event-a', occurrenceDate: '2026-09-08' });

    expect(occurrence).toBeDefined();
    expect(getTransportationPlanForScheduleOccurrence([plan], occurrence!)).toBe(plan);
  });

  it('links recurring occurrences using eventId and occurrenceDate', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'weekly', interval: 1, startDate: '2026-09-07', daysOfWeek: [1] },
    });
    const occurrence = getOccurrencesForDate([event], [], '2026-09-14')[0];
    const plan = makeTransportationPlan({ eventId: 'event-a', occurrenceDate: '2026-09-14' });

    expect(getTransportationPlanForScheduleOccurrence([plan], occurrence!)).toBe(plan);
  });

  it('allows two occurrences from the same recurring event to have different plans', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'weekly', interval: 1, startDate: '2026-09-07', daysOfWeek: [1] },
    });
    const occurrences = getOccurrencesForRange([event], [], '2026-09-07', '2026-09-14');
    const plans = [
      makeTransportationPlan({ id: 'transport-1', occurrenceDate: '2026-09-07', outbound: { ...makeTransportationPlan().outbound!, driverName: 'אבא' } }),
      makeTransportationPlan({ id: 'transport-2', occurrenceDate: '2026-09-14', outbound: { ...makeTransportationPlan().outbound!, driverName: 'אמא' } }),
    ];

    expect(getTransportationPlanForScheduleOccurrence(plans, occurrences[0]!)?.outbound?.driverName).toBe('אבא');
    expect(getTransportationPlanForScheduleOccurrence(plans, occurrences[1]!)?.outbound?.driverName).toBe('אמא');
  });

  it('keeps transportation linkage when a modified exception changes title time and location', () => {
    const event = makeEvent({
      date: null,
      recurrence: { frequency: 'weekly', interval: 1, startDate: '2026-09-07', daysOfWeek: [1] },
    });
    const exception = makeException({
      date: '2026-09-14',
      title: 'Changed activity',
      startTime: '18:30',
      location: 'New place',
    });
    const occurrence = getOccurrencesForDate([event], [exception], '2026-09-14')[0];
    const plan = makeTransportationPlan({ occurrenceDate: '2026-09-14' });

    expect(occurrence).toMatchObject({ title: 'Changed activity', startTime: '18:30', location: 'New place' });
    expect(getTransportationPlanForScheduleOccurrence([plan], occurrence!)).toBe(plan);
  });

  it('cleans transportation when deleting a custom one-time event', () => {
    const otherPlan = makeTransportationPlan({ id: 'transport-other', eventId: 'other-event' });

    expect(deleteTransportationPlansForEvent([makeTransportationPlan(), otherPlan], 'event-a')).toEqual([otherPlan]);
  });

  it('cleans all transportation when deleting a recurring series', () => {
    const firstPlan = makeTransportationPlan({ id: 'transport-1', occurrenceDate: '2026-09-07' });
    const secondPlan = makeTransportationPlan({ id: 'transport-2', occurrenceDate: '2026-09-14' });
    const otherPlan = makeTransportationPlan({ id: 'transport-other', eventId: 'other-event' });

    expect(deleteTransportationPlansForEvent([firstPlan, secondPlan, otherPlan], 'event-a')).toEqual([otherPlan]);
  });
});
