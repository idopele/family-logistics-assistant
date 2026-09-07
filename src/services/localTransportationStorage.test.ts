import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransportationPlan } from '../models';
import {
  deleteTransportationPlan,
  deleteTransportationPlansForEvent,
  getTransportationPlanForOccurrence,
  loadTransportationPlans,
  saveTransportationPlans,
  transportationPlansStorageKey,
  upsertTransportationPlan,
} from './localTransportationStorage';

const transportationPlan: TransportationPlan = {
  id: 'transport-a',
  eventId: 'event-a',
  occurrenceDate: '2026-09-08',
  outbound: {
    enabled: true,
    driverName: 'אבא',
    time: '16:50',
    from: 'הבית',
    to: 'ראשונים',
    passengerChildIds: ['daniel'],
    additionalPassengers: null,
    notes: null,
  },
  returnTrip: null,
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-08T12:00:00.000Z',
};

describe('localTransportationStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty array when storage is empty', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    expect(loadTransportationPlans()).toEqual([]);
  });

  it('saves and loads valid transportation plans', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    saveTransportationPlans([transportationPlan]);

    expect(loadTransportationPlans()).toEqual([transportationPlan]);
  });

  it('returns an empty array for invalid JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(transportationPlansStorageKey, '{bad json');
    vi.stubGlobal('localStorage', storage);

    expect(loadTransportationPlans()).toEqual([]);
  });

  it('rejects malformed plans safely', () => {
    const storage = createMemoryStorage();
    storage.setItem(transportationPlansStorageKey, JSON.stringify([{ ...transportationPlan, outbound: null, returnTrip: null }]));
    vi.stubGlobal('localStorage', storage);

    expect(loadTransportationPlans()).toEqual([]);
  });

  it('upserts the same eventId and date without duplicating', () => {
    const updatedPlan: TransportationPlan = {
      ...transportationPlan,
      id: 'transport-new-id',
      outbound: {
        ...transportationPlan.outbound!,
        driverName: 'אמא',
      },
      updatedAt: '2026-09-08T13:00:00.000Z',
    };

    expect(upsertTransportationPlan([transportationPlan], updatedPlan, '2026-09-08T13:00:00.000Z')).toHaveLength(1);
  });

  it('updates while preserving id and createdAt and changing updatedAt', () => {
    const updatedPlan: TransportationPlan = {
      ...transportationPlan,
      id: 'transport-new-id',
      createdAt: '2026-09-08T13:00:00.000Z',
    };
    const [result] = upsertTransportationPlan([transportationPlan], updatedPlan, '2026-09-08T14:00:00.000Z');

    expect(result).toMatchObject({
      id: 'transport-a',
      createdAt: '2026-09-08T12:00:00.000Z',
      updatedAt: '2026-09-08T14:00:00.000Z',
    });
  });

  it('deleting one plan does not affect others', () => {
    const secondPlan: TransportationPlan = { ...transportationPlan, id: 'transport-b', occurrenceDate: '2026-09-15' };

    expect(deleteTransportationPlan([transportationPlan, secondPlan], 'event-a', '2026-09-08')).toEqual([secondPlan]);
  });

  it('deleting all plans for an event removes only that event plans', () => {
    const sameEventSecondDate: TransportationPlan = { ...transportationPlan, id: 'transport-b', occurrenceDate: '2026-09-15' };
    const otherEventPlan: TransportationPlan = { ...transportationPlan, id: 'transport-c', eventId: 'event-b' };

    expect(deleteTransportationPlansForEvent([transportationPlan, sameEventSecondDate, otherEventPlan], 'event-a')).toEqual([
      otherEventPlan,
    ]);
  });

  it('finds a plan by eventId and occurrenceDate', () => {
    expect(getTransportationPlanForOccurrence([transportationPlan], 'event-a', '2026-09-08')).toEqual(transportationPlan);
    expect(getTransportationPlanForOccurrence([transportationPlan], 'event-a', '2026-09-09')).toBeNull();
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}
