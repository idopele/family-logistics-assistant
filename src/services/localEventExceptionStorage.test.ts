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

  it('loads saved exceptions for seed event overrides after refresh', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const seedException: EventException = {
      ...modifiedException,
      id: 'exception-seed-school-2026-09-08',
      eventId: 'seed-school-a',
      date: '2026-09-08',
      endTime: '12:30',
    };

    saveCustomEventExceptions([seedException]);

    expect(loadCustomEventExceptions()).toEqual([seedException]);
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

  it('upserts seed event exceptions without duplicating eventId and date', () => {
    const seedException: EventException = {
      ...modifiedException,
      id: 'exception-seed-a',
      eventId: 'seed-school-a',
      date: '2026-09-08',
      endTime: '12:30',
    };
    const updatedSeedException: EventException = {
      ...seedException,
      id: 'exception-seed-a-updated',
      endTime: '11:45',
    };

    expect(upsertCustomEventException([seedException], updatedSeedException)).toEqual([updatedSeedException]);
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
