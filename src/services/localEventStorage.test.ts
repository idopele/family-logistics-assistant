import { afterEach, describe, expect, it, vi } from 'vitest';
import { events as seedEvents } from '../data/events';
import type { Event } from '../models';
import { customEventsStorageKey, loadCustomEvents, saveCustomEvents } from './localEventStorage';

const customEvent: Event = {
  id: 'custom-event-a',
  childId: 'daniel',
  title: 'בדיקת רופאה',
  category: 'doctor',
  date: '2026-09-08',
  startTime: '15:20',
  endTime: null,
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
