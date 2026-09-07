import { describe, expect, it } from 'vitest';
import { translations } from '../i18n';
import type { Child, Event, EventException, TransportationLeg, TransportationPlan } from '../models';
import { getTransportationPlanForScheduleOccurrence } from './localTransportationStorage';
import { getOccurrencesForDate } from './scheduleEngine';
import {
  buildFamilyActionCenterData,
  getOccurrenceTimingStatus,
  getRemainingNonSchoolOccurrences,
} from './familyActionCenter';

const children: Child[] = [
  { id: 'daniel', name: 'דניאל', color: '#2563EB', isActive: true },
  { id: 'emanuel', name: 'עמנואל', color: '#DB2777', isActive: true },
];

const baseEvent: Event = {
  id: 'event-a',
  childId: 'daniel',
  title: 'אימון',
  category: 'basketball',
  customCategoryLabel: null,
  date: '2026-09-07',
  startTime: '17:00',
  endTime: '18:00',
  endsNextDay: false,
  location: 'אולם',
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const baseLeg: TransportationLeg = {
  enabled: true,
  driverName: 'אבא',
  time: '16:30',
  occursNextDay: false,
  from: null,
  to: 'אולם',
  passengerChildIds: ['daniel'],
  additionalPassengers: null,
  notes: null,
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
    date: '2026-09-07',
    type: 'modified',
    ...overrides,
  };
}

function makePlan(overrides: Partial<TransportationPlan> = {}): TransportationPlan {
  return {
    id: 'transport-a',
    eventId: 'event-a',
    occurrenceDate: '2026-09-07',
    outbound: baseLeg,
    returnTrip: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeLeg(overrides: Partial<TransportationLeg> = {}): TransportationLeg {
  return {
    ...baseLeg,
    ...overrides,
  };
}

describe('familyActionCenter', () => {
  it('returns today non-school occurrences', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.remainingNonSchoolOccurrences.map((occurrence) => occurrence.title)).toEqual(['אימון']);
  });

  it('keeps school events out of the meaningful activity list', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent({ id: 'school-a', category: 'school', title: 'מתמטיקה', startTime: '08:00' }), makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '07:30',
    });

    expect(data.remainingNonSchoolOccurrences).toHaveLength(1);
    expect(data.remainingNonSchoolOccurrences[0]?.category).toBe('basketball');
    expect(data.childSummaries[0]?.schoolLessonCount).toBe(1);
  });

  it('includes the latest school lesson start time in child summaries', () => {
    const data = buildFamilyActionCenterData({
      events: [
        makeEvent({ id: 'school-a', category: 'school', title: 'Math', startTime: '08:00' }),
        makeEvent({ id: 'school-b', category: 'school', title: 'Science', startTime: '13:30' }),
      ],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '07:30',
    });

    expect(data.childSummaries[0]).toMatchObject({
      schoolLessonCount: 2,
      lastSchoolLessonStartTime: '13:30',
    });
  });

  it('uses modified school occurrence times from the Schedule Engine', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent({ id: 'school-a', category: 'school', title: 'Math', startTime: '08:00' })],
      exceptions: [makeException({ eventId: 'school-a', startTime: '09:15' })],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '07:30',
    });

    expect(data.childSummaries[0]?.lastSchoolLessonStartTime).toBe('09:15');
  });

  it('preserves empty school summary behavior when there are no school events', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.childSummaries[0]).toMatchObject({
      schoolLessonCount: 0,
      lastSchoolLessonStartTime: null,
    });
  });

  it('has Hebrew and English labels for the school timing summary', () => {
    expect(translations.he.schoolToday).toBe('בית ספר היום:');
    expect(translations.he.lastLesson).toBe('שיעור אחרון');
    expect(translations.en.schoolToday).toBe('School today:');
    expect(translations.en.lastLesson).toBe('Last lesson');
  });

  it('resolves the next occurrence per child and skips passed occurrences', () => {
    const data = buildFamilyActionCenterData({
      events: [
        makeEvent({ id: 'passed-a', startTime: '09:00', endTime: '10:00' }),
        makeEvent({ id: 'next-a', startTime: '15:00', title: 'חוג' }),
      ],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.childSummaries[0]?.nextOccurrence?.eventId).toBe('next-a');
  });

  it('marks modified occurrences as changed', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [makeException({ startTime: '17:30' })],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.changedOccurrences).toHaveLength(1);
    expect(data.changedOccurrences[0]).toMatchObject({ startTime: '17:30', isException: true });
  });

  it('surfaces cancelled recurring occurrences separately and not as normal occurrences', () => {
    const recurringEvent = makeEvent({
      date: null,
      recurrence: { frequency: 'daily', interval: 1, startDate: '2026-09-07' },
    });
    const cancellation = makeException({ type: 'cancelled' });
    const data = buildFamilyActionCenterData({
      events: [recurringEvent],
      exceptions: [cancellation],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.cancellations).toMatchObject([{ title: 'אימון', time: '17:00' }]);
    expect(getOccurrencesForDate([recurringEvent], [cancellation], '2026-09-07')).toEqual([]);
    expect(data.remainingNonSchoolOccurrences).toEqual([]);
  });

  it('returns today transportation legs', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [makePlan()],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.transportationLegs).toMatchObject([{ time: '16:30', driverName: 'אבא', eventTitle: 'אימון' }]);
  });

  it('includes occursNextDay transport from yesterday today', () => {
    const yesterdayEvent = makeEvent({ date: '2026-09-06', startTime: '22:30', endTime: '01:30', endsNextDay: true });
    const data = buildFamilyActionCenterData({
      events: [yesterdayEvent],
      exceptions: [],
      transportationPlans: [
        makePlan({
          occurrenceDate: '2026-09-06',
          returnTrip: makeLeg({ time: '01:30', occursNextDay: true }),
          outbound: null,
        }),
      ],
      children,
      today: '2026-09-07',
      currentTime: '00:30',
    });

    expect(data.transportationLegs).toMatchObject([{ effectiveDate: '2026-09-07', time: '01:30' }]);
  });

  it('does not include tomorrow transportation today', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent({ date: '2026-09-08' })],
      exceptions: [],
      transportationPlans: [makePlan({ occurrenceDate: '2026-09-08' })],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.transportationLegs).toEqual([]);
  });

  it('scopes transportation conflicts to today', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent(), makeEvent({ id: 'event-b', childId: 'emanuel', title: 'ריקוד' })],
      exceptions: [],
      transportationPlans: [
        makePlan(),
        makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ passengerChildIds: ['emanuel'] }) }),
      ],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.transportationConflicts).toHaveLength(1);
  });

  it('is independent of weekly child and category filters', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.remainingNonSchoolOccurrences).toHaveLength(1);
  });

  it('does not depend on selected dashboard week', () => {
    const first = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });
    const second = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(second).toEqual(first);
  });

  it('recognizes an overnight event as active after midnight', () => {
    const occurrence = getOccurrencesForDate(
      [makeEvent({ date: '2026-09-06', startTime: '22:30', endTime: '01:30', endsNextDay: true })],
      [],
      '2026-09-06',
    )[0]!;

    expect(getOccurrenceTimingStatus(occurrence, '2026-09-07', '00:30')).toBe('inProgress');
  });

  it('includes custom children in child summaries', () => {
    const customChild: Child = { id: 'maya', name: 'מאיה', color: '#0f766e', isActive: true };
    const data = buildFamilyActionCenterData({
      events: [makeEvent({ childId: 'maya' })],
      exceptions: [],
      transportationPlans: [],
      children: [...children, customChild],
      today: '2026-09-07',
      currentTime: '12:00',
    });

    expect(data.childSummaries.map((summary) => summary.child.id)).toContain('maya');
  });

  it('treats missing transportation as neutral', () => {
    const data = buildFamilyActionCenterData({
      events: [makeEvent()],
      exceptions: [],
      transportationPlans: [],
      children,
      today: '2026-09-07',
      currentTime: '12:00',
    });
    const occurrence = data.remainingNonSchoolOccurrences[0]!;

    expect(data.transportationLegs).toEqual([]);
    expect(data.transportationConflicts).toEqual([]);
    expect(getTransportationPlanForScheduleOccurrence([], occurrence)).toBeNull();
  });

  it('filters passed occurrences out of remaining non-school occurrences', () => {
    const occurrences = getOccurrencesForDate([makeEvent({ startTime: '09:00', endTime: '10:00' })], [], '2026-09-07');

    expect(getRemainingNonSchoolOccurrences(occurrences, '2026-09-07', '12:00')).toEqual([]);
  });
});
