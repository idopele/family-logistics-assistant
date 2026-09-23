import { describe, expect, it } from 'vitest';
import type { Child, ScheduleOccurrence, TransportationLeg, TransportationPlan } from '../models';
import {
  detectTransportationConflicts,
  getTransportationLegEffectiveDate,
  normalizeDriverName,
  TRANSPORT_CONFLICT_WINDOW_MINUTES,
  validateTransportationPlanForSave,
} from './transportationConflictDetection';

const children: Child[] = [
  { id: 'daniel', name: 'דניאל', color: '#2563EB', isActive: true },
  { id: 'emanuel', name: 'עמנואל', color: '#DB2777', isActive: true },
];

const baseOccurrence: ScheduleOccurrence = {
  eventId: 'event-a',
  childId: 'daniel',
  date: '2026-09-08',
  title: 'אימון כדורסל',
  category: 'basketball',
  customCategoryLabel: null,
  startTime: '17:30',
  endTime: '19:00',
  endsNextDay: false,
  location: 'ראשונים',
  notes: null,
  status: 'scheduled',
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  isException: false,
};

const baseLeg: TransportationLeg = {
  enabled: true,
  driverName: 'אבא',
  time: '16:50',
  occursNextDay: false,
  from: null,
  to: 'ראשונים',
  passengerChildIds: ['daniel'],
  additionalPassengers: null,
  notes: null,
};

function makeOccurrence(overrides: Partial<ScheduleOccurrence> = {}): ScheduleOccurrence {
  return {
    ...baseOccurrence,
    ...overrides,
  };
}

function makePlan(overrides: Partial<TransportationPlan> = {}): TransportationPlan {
  return {
    id: 'transport-a',
    eventId: 'event-a',
    occurrenceDate: '2026-09-08',
    outbound: baseLeg,
    returnTrip: null,
    createdAt: '2026-09-08T12:00:00.000Z',
    updatedAt: '2026-09-08T12:00:00.000Z',
    ...overrides,
  };
}

function makeLeg(overrides: Partial<TransportationLeg> = {}): TransportationLeg {
  return {
    ...baseLeg,
    ...overrides,
  };
}

describe('transportationConflictDetection next-day handling', () => {
  it('uses the same date when occursNextDay is false', () => {
    const plan = makePlan({ occurrenceDate: '2026-09-12' });

    expect(getTransportationLegEffectiveDate(plan, makeLeg({ time: '01:30', occursNextDay: false }))).toBe('2026-09-12');
  });

  it('resolves occursNextDay true to the following local calendar date', () => {
    const plan = makePlan({ occurrenceDate: '2026-09-12' });

    expect(getTransportationLegEffectiveDate(plan, makeLeg({ time: '01:30', occursNextDay: true }))).toBe('2026-09-13');
  });

  it('resolves a Saturday next-day leg to Sunday', () => {
    const plan = makePlan({ occurrenceDate: '2026-09-12' });

    expect(getTransportationLegEffectiveDate(plan, makeLeg({ occursNextDay: true }))).toBe('2026-09-13');
  });

  it('uses local calendar math without UTC date shifting', () => {
    const plan = makePlan({ occurrenceDate: '2026-03-28' });

    expect(getTransportationLegEffectiveDate(plan, makeLeg({ occursNextDay: true }))).toBe('2026-03-29');
  });
});

describe('transportationConflictDetection driver normalization', () => {
  it('trims driver names', () => {
    expect(normalizeDriverName(' אבא ')).toBe(normalizeDriverName('אבא'));
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeDriverName('אמא   של   נועה')).toBe(normalizeDriverName('אמא של נועה'));
  });

  it('ignores Latin casing', () => {
    expect(normalizeDriverName('Yonti')).toBe(normalizeDriverName('yonti'));
  });

  it('keeps different driver names distinct', () => {
    expect(normalizeDriverName('אמא')).not.toBe(normalizeDriverName('ריני'));
  });
});

describe('transportationConflictDetection conflicts', () => {
  it('uses a 30 minute conflict window', () => {
    expect(TRANSPORT_CONFLICT_WINDOW_MINUTES).toBe(30);
  });

  it('same driver and same time produces a sameTime conflict', () => {
    const conflicts = detectTransportationConflicts(
      [
        makePlan(),
        makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ passengerChildIds: ['emanuel'] }) }),
      ],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b', childId: 'emanuel', title: 'בלט' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ severity: 'sameTime', minutesApart: 0 });
  });

  it('same driver 10 minutes apart produces a closeTiming conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:00' }) })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts[0]).toMatchObject({ severity: 'closeTiming', minutesApart: 10 });
  });

  it('same driver 30 minutes apart produces a conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:20' }) })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.minutesApart).toBe(30);
  });

  it('same driver 31 minutes apart does not produce a conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:21' }) })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toEqual([]);
  });

  it('different drivers do not conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ driverName: 'אמא' }) })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toEqual([]);
  });

  it('same driver on different effective dates does not conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', occurrenceDate: '2026-09-09' })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b', date: '2026-09-09' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toEqual([]);
  });

  it('does not return duplicate A/B and B/A conflicts', () => {
    const conflicts = detectTransportationConflicts(
      [
        makePlan(),
        makePlan({ id: 'transport-b', eventId: 'event-b' }),
        makePlan({ id: 'transport-c', eventId: 'event-c', outbound: makeLeg({ driverName: 'אמא' }) }),
      ],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' }), makeOccurrence({ eventId: 'event-c' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toHaveLength(1);
  });

  it('multiple passengers in the same leg do not create a conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan({ outbound: makeLeg({ passengerChildIds: ['daniel', 'emanuel'] }) })],
      [makeOccurrence()],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toEqual([]);
  });

  it('includes every visible participant from a shared event in conflict items', () => {
    const conflicts = detectTransportationConflicts(
      [
        makePlan({ outbound: makeLeg({ passengerChildIds: ['daniel'] }) }),
        makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ passengerChildIds: ['emanuel'] }) }),
      ],
      [
        makeOccurrence({ participantIds: ['daniel', 'emanuel'] }),
        makeOccurrence({ eventId: 'event-b', childId: 'emanuel', title: 'בלט' }),
      ],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.first.childNames).toEqual(expect.arrayContaining(['דניאל', 'עמנואל']));
  });

  it('changing driver removes a conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ driverName: 'אמא' }) })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toEqual([]);
  });

  it('changing time outside threshold removes a conflict', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:22' }) })],
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts).toEqual([]);
  });

  it('compares recurring occurrences with separate transportation plans', () => {
    const conflicts = detectTransportationConflicts(
      [
        makePlan({ id: 'transport-a1', occurrenceDate: '2026-09-08' }),
        makePlan({ id: 'transport-a2', occurrenceDate: '2026-09-15' }),
        makePlan({ id: 'transport-b2', eventId: 'event-b', occurrenceDate: '2026-09-15', outbound: makeLeg({ time: '17:00' }) }),
      ],
      [
        makeOccurrence({ date: '2026-09-08' }),
        makeOccurrence({ date: '2026-09-15' }),
        makeOccurrence({ eventId: 'event-b', date: '2026-09-15', title: 'ריקוד' }),
      ],
      children,
      '2026-09-13',
      '2026-09-19',
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.first.occurrenceDate).toBe('2026-09-15');
  });

  it('uses modified occurrence title while keeping transportation linkage', () => {
    const conflicts = detectTransportationConflicts(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:00' }) })],
      [makeOccurrence({ title: 'אימון שהשתנה' }), makeOccurrence({ eventId: 'event-b', title: 'בלט' })],
      children,
      '2026-09-06',
      '2026-09-12',
    );

    expect(conflicts[0]?.first.eventTitle).toBe('אימון שהשתנה');
  });

  it('filters conflicts by effective transport date inside the selected week', () => {
    const conflicts = detectTransportationConflicts(
      [
        makePlan({ occurrenceDate: '2026-09-12', outbound: makeLeg({ time: '01:30', occursNextDay: true }) }),
        makePlan({
          id: 'transport-b',
          eventId: 'event-b',
          occurrenceDate: '2026-09-13',
          outbound: makeLeg({ time: '01:45' }),
        }),
      ],
      [
        makeOccurrence({ date: '2026-09-12' }),
        makeOccurrence({ eventId: 'event-b', date: '2026-09-13' }),
      ],
      children,
      '2026-09-13',
      '2026-09-19',
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.first.effectiveDate).toBe('2026-09-13');
  });
});

describe('transportationConflictDetection pre-save validation', () => {
  it('blocks same driver on the same effective date and exact same time', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b' }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('blocked');
    expect(result.conflicts[0]?.severity).toBe('sameTime');
  });

  it('blocks normalized driver spelling and whitespace matches', () => {
    const result = validateTransportationPlanForSave(
      [makePlan({ outbound: makeLeg({ driverName: 'Yonti' }) })],
      makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ driverName: ' yonti  ' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('blocked');
  });

  it('allows a different driver at the same time', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ driverName: 'אמא' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('allowed');
  });

  it('allows the same driver on a different effective date', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b', occurrenceDate: '2026-09-09' }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b', date: '2026-09-09' })],
      children,
    );

    expect(result.status).toBe('allowed');
  });

  it('returns a warning for the same driver 10 minutes apart', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:00' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('warning');
    expect(result.conflicts[0]?.minutesApart).toBe(10);
  });

  it('returns a warning for the same driver 30 minutes apart', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:20' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('warning');
    expect(result.conflicts[0]?.minutesApart).toBe(30);
  });

  it('allows the same driver 31 minutes apart without a warning', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:21' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('allowed');
  });

  it('marks closeTiming warnings as overridable', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '17:00' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('warning');
    expect(result.conflicts.every((conflict) => conflict.severity === 'closeTiming')).toBe(true);
  });

  it('does not allow exact sameTime conflicts to be overridden', () => {
    const result = validateTransportationPlanForSave(
      [makePlan()],
      makePlan({ id: 'transport-b', eventId: 'event-b' }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('blocked');
    expect(result.conflicts.some((conflict) => conflict.severity === 'sameTime')).toBe(true);
  });

  it('editing a plan does not conflict with itself', () => {
    const result = validateTransportationPlanForSave([makePlan()], makePlan(), [makeOccurrence()], children);

    expect(result.status).toBe('allowed');
  });

  it('editing a plan into another plan exact time is blocked', () => {
    const result = validateTransportationPlanForSave(
      [makePlan(), makePlan({ id: 'transport-b', eventId: 'event-b', outbound: makeLeg({ time: '18:00' }) })],
      makePlan({ outbound: makeLeg({ time: '18:00' }) }),
      [makeOccurrence(), makeOccurrence({ eventId: 'event-b' })],
      children,
    );

    expect(result.status).toBe('blocked');
  });

  it('uses occursNextDay effective dates for exact conflicts', () => {
    const result = validateTransportationPlanForSave(
      [makePlan({ occurrenceDate: '2026-09-13', outbound: makeLeg({ time: '01:00' }) })],
      makePlan({
        id: 'transport-b',
        eventId: 'event-b',
        occurrenceDate: '2026-09-12',
        outbound: makeLeg({ time: '01:00', occursNextDay: true }),
      }),
      [makeOccurrence({ date: '2026-09-13' }), makeOccurrence({ eventId: 'event-b', date: '2026-09-12' })],
      children,
    );

    expect(result.status).toBe('blocked');
  });

  it('does not treat multiple passengers in one leg as a pre-save conflict', () => {
    const result = validateTransportationPlanForSave(
      [],
      makePlan({ outbound: makeLeg({ passengerChildIds: ['daniel', 'emanuel'] }) }),
      [makeOccurrence()],
      children,
    );

    expect(result.status).toBe('allowed');
  });
});
