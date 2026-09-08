import { describe, expect, it } from 'vitest';
import { getEventCategoryLabel } from '../data/eventCategories';
import { customEventsStorageKey } from '../services/localEventStorage';
import { buildEventFromFormValues, type AddEventFormValues } from '../components/AddEventDialog';
import {
  UI_LANGUAGE_STORAGE_KEY,
  UI_THEME_STORAGE_KEY,
  applyUiPreferencesToDocument,
  loadLanguagePreference,
  loadThemePreference,
  saveLanguagePreference,
  saveThemePreference,
} from './index';

const validValues: AddEventFormValues = {
  childId: 'daniel',
  category: 'other',
  customCategoryLabel: '',
  title: 'אקרובטיקה',
  date: '2026-09-12',
  recurrenceMode: 'oneTime',
  recurrenceStartDate: '2026-09-12',
  recurrenceFrequency: 'weekly',
  recurrenceInterval: '1',
  recurrenceDaysOfWeek: [6],
  recurrenceEndMode: 'none',
  recurrenceEndDate: '',
  startTime: '18:00',
  endTime: '22:00',
  endsNextDay: false,
  reminderMinutesBefore: '',
  location: 'מיקה',
  notes: 'להביא נעליים',
};

describe('UI preferences', () => {
  it('defaults language to Hebrew', () => {
    expect(loadLanguagePreference(new MemoryStorage())).toBe('he');
  });

  it('loads a saved English preference', () => {
    const storage = new MemoryStorage([[UI_LANGUAGE_STORAGE_KEY, 'en']]);

    expect(loadLanguagePreference(storage)).toBe('en');
  });

  it('falls back to Hebrew for an invalid language preference', () => {
    const storage = new MemoryStorage([[UI_LANGUAGE_STORAGE_KEY, 'fr']]);

    expect(loadLanguagePreference(storage)).toBe('he');
  });

  it('defaults theme to light', () => {
    expect(loadThemePreference(new MemoryStorage())).toBe('light');
  });

  it('loads a saved dark preference', () => {
    const storage = new MemoryStorage([[UI_THEME_STORAGE_KEY, 'dark']]);

    expect(loadThemePreference(storage)).toBe('dark');
  });

  it('falls back to light for an invalid theme preference', () => {
    const storage = new MemoryStorage([[UI_THEME_STORAGE_KEY, 'sepia']]);

    expect(loadThemePreference(storage)).toBe('light');
  });

  it('switching Hebrew to English changes document direction from rtl to ltr', () => {
    const root = createDocumentRoot();

    applyUiPreferencesToDocument(root, 'he', 'light');
    expect(root.dir).toBe('rtl');

    applyUiPreferencesToDocument(root, 'en', 'light');
    expect(root.lang).toBe('en');
    expect(root.dir).toBe('ltr');
  });

  it('switching English to Hebrew restores rtl direction', () => {
    const root = createDocumentRoot();

    applyUiPreferencesToDocument(root, 'en', 'dark');
    applyUiPreferencesToDocument(root, 'he', 'dark');

    expect(root.lang).toBe('he');
    expect(root.dir).toBe('rtl');
  });

  it('resolves predefined category labels in Hebrew', () => {
    expect(getEventCategoryLabel({ category: 'doctor', customCategoryLabel: null }, 'he')).toBe('רופא');
  });

  it('resolves predefined category labels in English', () => {
    expect(getEventCategoryLabel({ category: 'doctor', customCategoryLabel: null }, 'en')).toBe('Doctor');
  });

  it('does not translate a user event title', () => {
    const event = buildEventFromFormValues(validValues, null, '2026-09-12T12:00:00.000Z');

    expect(event.title).toBe('אקרובטיקה');
  });

  it('does not translate a custom category label', () => {
    expect(getEventCategoryLabel({ category: 'other', customCategoryLabel: 'מסיבה' }, 'en')).toBe('מסיבה');
  });

  it('language preference persistence does not alter stored Events', () => {
    const storage = new MemoryStorage([[customEventsStorageKey, '[{"id":"event-a","title":"אקרובטיקה"}]']]);

    saveLanguagePreference('en', storage);

    expect(storage.getItem(customEventsStorageKey)).toBe('[{"id":"event-a","title":"אקרובטיקה"}]');
  });

  it('theme preference persistence does not alter stored Events', () => {
    const storage = new MemoryStorage([[customEventsStorageKey, '[{"id":"event-a","title":"אקרובטיקה"}]']]);

    saveThemePreference('dark', storage);

    expect(storage.getItem(customEventsStorageKey)).toBe('[{"id":"event-a","title":"אקרובטיקה"}]');
  });

  it('persists dark and light theme preferences', () => {
    const storage = new MemoryStorage();

    saveThemePreference('dark', storage);
    expect(loadThemePreference(storage)).toBe('dark');

    saveThemePreference('light', storage);
    expect(loadThemePreference(storage)).toBe('light');
  });

  it('persists language preferences', () => {
    const storage = new MemoryStorage();

    saveLanguagePreference('en', storage);
    expect(loadLanguagePreference(storage)).toBe('en');

    saveLanguagePreference('he', storage);
    expect(loadLanguagePreference(storage)).toBe('he');
  });

  it('applies all four language and theme combinations', () => {
    const root = createDocumentRoot();

    applyUiPreferencesToDocument(root, 'he', 'light');
    expect(root).toMatchObject({ lang: 'he', dir: 'rtl', dataset: { theme: 'light' } });

    applyUiPreferencesToDocument(root, 'he', 'dark');
    expect(root).toMatchObject({ lang: 'he', dir: 'rtl', dataset: { theme: 'dark' } });

    applyUiPreferencesToDocument(root, 'en', 'light');
    expect(root).toMatchObject({ lang: 'en', dir: 'ltr', dataset: { theme: 'light' } });

    applyUiPreferencesToDocument(root, 'en', 'dark');
    expect(root).toMatchObject({ lang: 'en', dir: 'ltr', dataset: { theme: 'dark' } });
  });
});

function createDocumentRoot(): Pick<HTMLElement, 'lang' | 'dir' | 'dataset'> {
  return {
    lang: '',
    dir: '',
    dataset: {},
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  constructor(entries: [string, string][] = []) {
    entries.forEach(([key, value]) => this.values.set(key, value));
  }

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
