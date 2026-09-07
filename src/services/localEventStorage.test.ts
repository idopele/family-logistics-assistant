import { afterEach, describe, expect, it, vi } from 'vitest';
import { events as seedEvents } from '../data/events';
import type { Event } from '../models';
import {
  customEventsStorageKey,
  deleteCustomEvent,
  loadCustomEvents,
  saveCustomEvents,
  updateCustomEvent,
} from './localEventStorage';

const customEvent: Event = {
  id: 'custom-event-a',
  childId: 'daniel',
  title: 'בדיקת רופאה',
  category: 'doctor',
  customCategoryLabel: null,
  date: '2026-09-08',
  startTime: '15:20',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-08T12:00:00.000Z',
  updatedAt: '2026-09-08T12:00:00.000Z',
};

describe('localEventStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty array when storage is empty', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    expect(loadCustomEvents()).toEqual([]);
  });

  it('loads saved custom events', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    saveCustomEvents([customEvent]);

    expect(loadCustomEvents()).toEqual([customEvent]);
  });

  it('loads valid recurring custom events', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const recurringEvent: Event = {
      ...customEvent,
      id: 'custom-recurring-a',
      date: null,
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        startDate: '2026-09-13',
        endDate: null,
        daysOfWeek: [0, 3],
      },
    };

    saveCustomEvents([recurringEvent]);

    expect(loadCustomEvents()).toEqual([recurringEvent]);
  });

  it('rejects stored events with both date and recurrence', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      customEventsStorageKey,
      JSON.stringify([
        {
          ...customEvent,
          recurrence: {
            frequency: 'weekly',
            interval: 1,
            startDate: '2026-09-13',
            endDate: null,
            daysOfWeek: [0],
          },
        },
      ]),
    );
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomEvents()).toEqual([]);
  });

  it('rejects stored events with neither date nor recurrence', () => {
    const storage = createMemoryStorage();
    storage.setItem(customEventsStorageKey, JSON.stringify([{ ...customEvent, date: null, recurrence: null }]));
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomEvents()).toEqual([]);
  });

  it.each(['work', 'romanticDate', 'meal', 'privateLesson'] as const)('loads %s category custom events', (category) => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const event: Event = {
      ...customEvent,
      id: `custom-${category}`,
      category,
    };

    saveCustomEvents([event]);

    expect(loadCustomEvents()[0]?.category).toBe(category);
  });

  it('keeps existing localStorage events loadable', () => {
    const storage = createMemoryStorage();
    storage.setItem(customEventsStorageKey, JSON.stringify([customEvent]));
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomEvents()[0]).toMatchObject({
      id: customEvent.id,
      title: customEvent.title,
      endsNextDay: false,
    });
  });

  it('returns an empty array for invalid JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(customEventsStorageKey, '{bad json');
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomEvents()).toEqual([]);
  });

  it('returns an empty array for non-array stored data', () => {
    const storage = createMemoryStorage();
    storage.setItem(customEventsStorageKey, JSON.stringify({ event: customEvent }));
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomEvents()).toEqual([]);
  });

  it('does not modify seed events when saving custom storage', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const seedEventsBeforeSave = [...seedEvents];

    saveCustomEvents([customEvent]);

    expect(seedEvents).toEqual(seedEventsBeforeSave);
    expect(seedEvents).not.toContain(customEvent);
  });

  it('migrates exact parent meeting titles from other to parentMeeting without duplicating', () => {
    const storage = createMemoryStorage();
    const parentMeetingEvent: Event = {
      ...customEvent,
      id: 'custom-parent-meeting-a',
      title: 'אסיפת הורים',
      category: 'other',
    };
    storage.setItem(customEventsStorageKey, JSON.stringify([parentMeetingEvent]));
    vi.stubGlobal('localStorage', storage);

    const loadedEvents = loadCustomEvents();
    const persistedEvents = JSON.parse(storage.getItem(customEventsStorageKey) ?? '[]') as Event[];

    expect(loadedEvents).toHaveLength(1);
    expect(loadedEvents[0]).toEqual({
      ...parentMeetingEvent,
      category: 'parentMeeting',
    });
    expect(persistedEvents).toHaveLength(1);
    expect(persistedEvents[0]?.category).toBe('parentMeeting');
  });

  it('migrates old stored events without endsNextDay to false', () => {
    const storage = createMemoryStorage();
    const oldCustomEvent: Omit<Event, 'endsNextDay'> = {
      id: 'old-custom-event-a',
      childId: 'daniel',
      title: 'Late pickup',
      category: 'other',
      customCategoryLabel: null,
      date: '2026-09-12',
      startTime: '22:30',
      endTime: '23:00',
      location: null,
      notes: null,
      recurrence: null,
      requiresTransportation: false,
      pickupTime: null,
      dropoffTime: null,
      status: 'scheduled',
      createdAt: '2026-09-12T18:00:00.000Z',
      updatedAt: '2026-09-12T18:00:00.000Z',
    };
    storage.setItem(customEventsStorageKey, JSON.stringify([oldCustomEvent]));
    vi.stubGlobal('localStorage', storage);

    const loadedEvents = loadCustomEvents();
    const persistedEvents = JSON.parse(storage.getItem(customEventsStorageKey) ?? '[]') as Event[];

    expect(loadedEvents).toHaveLength(1);
    expect(loadedEvents[0]?.endsNextDay).toBe(false);
    expect(persistedEvents).toHaveLength(1);
    expect(persistedEvents[0]?.endsNextDay).toBe(false);
  });

  it('migrates old stored events without customCategoryLabel to null', () => {
    const storage = createMemoryStorage();
    const oldCustomEvent: Omit<Event, 'customCategoryLabel'> = {
      id: 'old-custom-event-b',
      childId: 'daniel',
      title: 'Legacy event',
      category: 'other',
      date: '2026-09-12',
      startTime: '18:00',
      endTime: null,
      endsNextDay: false,
      location: null,
      notes: null,
      recurrence: null,
      requiresTransportation: false,
      pickupTime: null,
      dropoffTime: null,
      status: 'scheduled',
      createdAt: '2026-09-12T18:00:00.000Z',
      updatedAt: '2026-09-12T18:00:00.000Z',
    };
    storage.setItem(customEventsStorageKey, JSON.stringify([oldCustomEvent]));
    vi.stubGlobal('localStorage', storage);

    const loadedEvents = loadCustomEvents();
    const persistedEvents = JSON.parse(storage.getItem(customEventsStorageKey) ?? '[]') as Event[];

    expect(loadedEvents[0]?.customCategoryLabel).toBeNull();
    expect(persistedEvents[0]?.customCategoryLabel).toBeNull();
  });

  it('updates a custom event while preserving its id and createdAt', () => {
    const updatedEvent: Event = {
      ...customEvent,
      title: 'Updated title',
      date: '2026-09-10',
      startTime: '16:30',
      updatedAt: '2026-09-09T10:00:00.000Z',
    };

    const updatedEvents = updateCustomEvent([customEvent], updatedEvent);

    expect(updatedEvents).toHaveLength(1);
    expect(updatedEvents[0]).toMatchObject({
      id: customEvent.id,
      createdAt: customEvent.createdAt,
      updatedAt: '2026-09-09T10:00:00.000Z',
      title: 'Updated title',
      date: '2026-09-10',
      startTime: '16:30',
    });
    expect(updatedEvents[0]?.updatedAt).not.toBe(customEvent.updatedAt);
  });

  it('persists edited title, date, time, and endsNextDay', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    const updatedEvent: Event = {
      ...customEvent,
      title: 'Overnight visit',
      date: '2026-09-12',
      startTime: '23:30',
      endTime: '02:00',
      endsNextDay: true,
      updatedAt: '2026-09-12T20:00:00.000Z',
    };

    saveCustomEvents(updateCustomEvent([customEvent], updatedEvent));

    expect(loadCustomEvents()[0]).toMatchObject({
      id: customEvent.id,
      title: 'Overnight visit',
      date: '2026-09-12',
      startTime: '23:30',
      endTime: '02:00',
      endsNextDay: true,
    });
  });

  it('deletes exactly one custom event', () => {
    const secondEvent: Event = { ...customEvent, id: 'custom-event-b', title: 'Second event' };

    expect(deleteCustomEvent([customEvent, secondEvent], customEvent.id)).toEqual([secondEvent]);
  });

  it('deleting one event does not affect other custom events', () => {
    const secondEvent: Event = { ...customEvent, id: 'custom-event-b', title: 'Second event' };
    const thirdEvent: Event = { ...customEvent, id: 'custom-event-c', title: 'Third event' };

    expect(deleteCustomEvent([customEvent, secondEvent, thirdEvent], secondEvent.id)).toEqual([customEvent, thirdEvent]);
  });

  it('does not modify seed events through custom storage helpers', () => {
    const seedEventsBeforeUpdate = [...seedEvents];
    const updatedEvent: Event = { ...customEvent, title: 'Only custom changed' };

    updateCustomEvent([customEvent], updatedEvent);
    deleteCustomEvent([customEvent], customEvent.id);

    expect(seedEvents).toEqual(seedEventsBeforeUpdate);
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
