import { afterEach, describe, expect, it, vi } from 'vitest';

import { children as seedChildren } from '../data/children';
import { events as seedEvents } from '../data/events';
import type { Child, Event, EventException, TransportationPlan } from '../models';
import { getOccurrencesForRange } from './scheduleEngine';
import {
  hasLocalFamilyData,
  importLocalFamilyData,
  isLocalMigrationConfirmed,
  loadSharedFamilyState,
  mergeSharedChildren,
  mergeSharedEvents,
  parseSharedFamilyState,
  upsertSharedEvent,
  upsertSharedEventExceptionInState,
  upsertSharedTransportationPlanInState,
} from './sharedFamilyData';
import {
  isChild as isApiChild,
  isEvent as isApiEvent,
  isEventException as isApiEventException,
  isTransportationPlan as isApiTransportationPlan,
} from '../../functions/api/sharedData';
import { detectTransportationConflicts } from './transportationConflictDetection';

const child: Child = {
  id: 'custom-child-a',
  name: 'Alex',
  color: '#0f766e',
  isActive: true,
};

const event: Event = {
  id: 'custom-event-a',
  childId: 'custom-child-a',
  title: 'Guitar',
  category: 'other',
  customCategoryLabel: null,
  date: '2026-09-08',
  startTime: '17:00',
  endTime: '18:00',
  endsNextDay: false,
  location: 'Studio',
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
};

const exception: EventException = {
  id: 'exception-daniel-doctor-20260908-1520-2026-09-08',
  eventId: 'daniel-doctor-20260908-1520',
  date: '2026-09-08',
  type: 'modified',
  startTime: '16:00',
};

const transportationPlan: TransportationPlan = {
  id: 'transport-a',
  eventId: 'custom-event-a',
  occurrenceDate: '2026-09-08',
  outbound: {
    enabled: true,
    driverName: 'Dad',
    time: '16:40',
    occursNextDay: false,
    from: 'Home',
    to: 'Studio',
    passengerChildIds: ['custom-child-a'],
    additionalPassengers: null,
    notes: null,
  },
  returnTrip: null,
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shared family data client service', () => {
  it('parses a valid shared state response', () => {
    expect(
      parseSharedFamilyState({
        customChildren: [child],
        customEvents: [event],
      eventExceptions: [exception],
      transportationPlans: [transportationPlan],
      eventReminders: [],
      initialized: true,
      }),
    ).toEqual({
      customChildren: [child],
      customEvents: [event],
      eventExceptions: [exception],
      transportationPlans: [transportationPlan],
      eventReminders: [],
      calendarSourceSettings: expect.objectContaining({
        israel_holidays: { enabled: true, includeMinorObservances: false },
      }),
      authorization: undefined,
      initialized: true,
    });
  });

  it('rejects invalid server payloads', () => {
    expect(
      parseSharedFamilyState({
        customChildren: [{}],
        customEvents: [],
        eventExceptions: [],
        transportationPlans: [],
        initialized: true,
      }),
    ).toBeNull();
  });

  it('loads shared family state through the same-origin API', async () => {
    const fetcher = vi.fn(async () => Response.json({
      customChildren: [child],
      customEvents: [],
      eventExceptions: [],
      transportationPlans: [],
      initialized: true,
    }));

    await expect(loadSharedFamilyState(fetcher)).resolves.toMatchObject({
      customChildren: [child],
      initialized: true,
    });
    expect(fetcher).toHaveBeenCalledWith('/api/shared', { headers: { Accept: 'application/json' } });
  });

  it('merges shared children with seed children', () => {
    expect(mergeSharedChildren(seedChildren, [child]).map((item) => item.id)).toContain('custom-child-a');
  });

  it('merges shared events with seed events', () => {
    expect(mergeSharedEvents(seedEvents, [event]).map((item) => item.id)).toContain('custom-event-a');
  });

  it('shared exceptions affect the Schedule Engine', () => {
    const occurrences = getOccurrencesForRange(seedEvents, [exception], '2026-09-08', '2026-09-08');
    const doctorOccurrence = occurrences.find((occurrence) => occurrence.eventId === exception.eventId);

    expect(doctorOccurrence?.startTime).toBe('16:00');
    expect(doctorOccurrence?.isException).toBe(true);
  });

  it('shared transportation affects conflict detection', () => {
    const secondPlan: TransportationPlan = {
      ...transportationPlan,
      id: 'transport-b',
      eventId: 'daniel-doctor-20260908-1520',
      occurrenceDate: '2026-09-08',
      outbound: transportationPlan.outbound === null ? null : { ...transportationPlan.outbound, passengerChildIds: ['daniel'] },
    };
    const occurrences = getOccurrencesForRange([...seedEvents, event], [], '2026-09-08', '2026-09-08');

    expect(
      detectTransportationConflicts(
        [transportationPlan, secondPlan],
        occurrences,
        [...seedChildren, child],
        '2026-09-08',
        '2026-09-08',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('failed mutations reject instead of pretending the save succeeded', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(upsertSharedEvent(event, fetcher)).rejects.toThrow('Could not save shared family data.');
  });

  it('detects local data for migration', () => {
    expect(
      hasLocalFamilyData({
        customChildren: [child],
        customEvents: [],
        eventExceptions: [],
        transportationPlans: [],
        eventReminders: [],
      }),
    ).toBe(true);
  });

  it('does not include language or theme in migration requests', async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true }));

    await importLocalFamilyData(
      {
        customChildren: [child],
        customEvents: [event],
        eventExceptions: [exception],
        transportationPlans: [transportationPlan],
        eventReminders: [],
      },
      fetcher,
    );

    const [, requestInit] = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const requestBody = JSON.parse(String(requestInit.body)) as Record<string, unknown>;

    expect(requestBody).not.toHaveProperty('language');
    expect(requestBody).not.toHaveProperty('theme');
    expect(requestBody.payload).not.toHaveProperty('language');
    expect(requestBody.payload).not.toHaveProperty('theme');
  });

  it('confirms idempotent local migration by stable ids and event dates', () => {
    expect(
      isLocalMigrationConfirmed(
        {
          customChildren: [child],
          customEvents: [event],
          eventExceptions: [exception],
          transportationPlans: [transportationPlan],
          eventReminders: [],
        },
        {
          customChildren: [child],
          customEvents: [event],
      eventExceptions: [exception],
      transportationPlans: [transportationPlan],
      eventReminders: [],
      initialized: true,
        },
      ),
    ).toBe(true);
  });

  it('updates duplicate event exceptions instead of duplicating them', () => {
    const updatedException = { ...exception, startTime: '16:30' };
    const exceptions = upsertSharedEventExceptionInState([exception], updatedException);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]?.startTime).toBe('16:30');
  });

  it('updates duplicate transportation event/date plans instead of duplicating them', () => {
    const updatedPlan = { ...transportationPlan, id: 'transport-c', updatedAt: '2026-09-08T00:00:00.000Z' };
    const plans = upsertSharedTransportationPlanInState([transportationPlan], updatedPlan);

    expect(plans).toHaveLength(1);
    expect(plans[0]?.id).toBe('transport-c');
  });
});

describe('shared family data API validation', () => {
  it('rejects malformed Child payloads', () => {
    expect(isApiChild({ id: '', name: 'Alex', color: '#fff', isActive: true })).toBe(false);
  });

  it('rejects malformed Event payloads', () => {
    expect(isApiEvent({ ...event, endsNextDay: undefined })).toBe(false);
  });

  it('rejects malformed EventException payloads', () => {
    expect(isApiEventException({ ...exception, type: 'skipped' })).toBe(false);
  });

  it('rejects malformed TransportationPlan payloads', () => {
    expect(isApiTransportationPlan({ ...transportationPlan, outbound: null, returnTrip: null })).toBe(false);
  });
});
