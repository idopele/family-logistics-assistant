import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventException } from '../models';
import {
  customEventExceptionsStorageKey,
  deleteCustomEventExceptionsForEvent,
  loadCustomEventExceptions,
  saveCustomEventExceptions,
  upsertCustomEventException,
} from './localEventExceptionStorage';

const modifiedException: EventException = {
  id: 'exception-custom-recurring-a-2026-09-15',
  eventId: 'custom-recurring-a',
  date: '2026-09-15',
  type: 'modified',
  title: 'Updated occurrence',
  startTime: '18:30',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: 'Only this date',
};

describe('localEventExceptionStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty array when storage is empty', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    expect(loadCustomEventExceptions()).toEqual([]);
  });

  it('loads saved custom event exceptions', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    saveCustomEventExceptions([modifiedException]);

    expect(loadCustomEventExceptions()).toEqual([modifiedException]);
  });

  it('ignores invalid stored exception data', () => {
    const storage = createMemoryStorage();
    storage.setItem(customEventExceptionsStorageKey, JSON.stringify([{ ...modifiedException, type: 'bad' }]));
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomEventExceptions()).toEqual([]);
  });

  it('upserts by eventId and date without duplicating', () => {
    const updatedException: EventException = {
      ...modifiedException,
      id: 'updated-exception',
      startTime: '19:00',
    };

    expect(upsertCustomEventException([modifiedException], updatedException)).toEqual([updatedException]);
  });

  it('deletes exceptions only for the selected event series', () => {
    const otherException: EventException = {
      ...modifiedException,
      id: 'exception-other',
      eventId: 'custom-recurring-b',
    };

    expect(deleteCustomEventExceptionsForEvent([modifiedException, otherException], 'custom-recurring-a')).toEqual([
      otherException,
    ]);
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
