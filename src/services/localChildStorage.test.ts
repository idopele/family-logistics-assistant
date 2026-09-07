import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Child } from '../models';
import { customChildrenStorageKey, loadCustomChildren, saveCustomChildren } from './localChildStorage';

const customChild: Child = {
  id: 'custom-child-a',
  name: 'נועה',
  color: '#7C3AED',
  isActive: true,
};

describe('localChildStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty array when storage is empty', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    expect(loadCustomChildren()).toEqual([]);
  });

  it('loads saved custom children', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());

    saveCustomChildren([customChild]);

    expect(loadCustomChildren()).toEqual([customChild]);
  });

  it('returns an empty array for invalid JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem(customChildrenStorageKey, '{bad json');
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomChildren()).toEqual([]);
  });

  it('returns an empty array for non-array stored data', () => {
    const storage = createMemoryStorage();
    storage.setItem(customChildrenStorageKey, JSON.stringify({ child: customChild }));
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomChildren()).toEqual([]);
  });

  it('safely ignores malformed child records', () => {
    const storage = createMemoryStorage();
    storage.setItem(customChildrenStorageKey, JSON.stringify([customChild, { id: '', name: 'Missing color' }]));
    vi.stubGlobal('localStorage', storage);

    expect(loadCustomChildren()).toEqual([customChild]);
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
