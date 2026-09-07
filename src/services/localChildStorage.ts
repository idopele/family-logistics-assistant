import type { Child } from '../models';

export const customChildrenStorageKey = 'family-logistics-custom-children-v1';

export function loadCustomChildren(): Child[] {
  const storage = getStorage();

  if (storage === null) {
    return [];
  }

  const rawValue = storage.getItem(customChildrenStorageKey);

  if (rawValue === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isStoredChild);
  } catch {
    return [];
  }
}

export function saveCustomChildren(children: Child[]): void {
  const storage = getStorage();

  if (storage === null) {
    return;
  }

  storage.setItem(customChildrenStorageKey, JSON.stringify(children));
}

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function isStoredChild(value: unknown): value is Child {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const child = value as Partial<Child>;

  return (
    typeof child.id === 'string' &&
    child.id.trim() !== '' &&
    typeof child.name === 'string' &&
    child.name.trim() !== '' &&
    typeof child.color === 'string' &&
    child.color.trim() !== '' &&
    typeof child.isActive === 'boolean'
  );
}
