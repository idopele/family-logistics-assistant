import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  UI_LANGUAGE_STORAGE_KEY,
  UI_THEME_STORAGE_KEY,
  isLanguage,
  isThemeMode,
  languageDirections,
  translations,
  type Language,
  type ThemeMode,
  type TranslationKey,
} from './translations';

interface UiPreferencesContextValue {
  language: Language;
  theme: ThemeMode;
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemeMode) => void;
  t: (key: TranslationKey) => string;
}

const UiPreferencesContext = createContext<UiPreferencesContextValue | null>(null);

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => loadLanguagePreference());
  const [theme, setThemeState] = useState<ThemeMode>(() => loadThemePreference());

  useEffect(() => {
    applyUiPreferencesToDocument(document.documentElement, language, theme);
  }, [language, theme]);

  const value = useMemo<UiPreferencesContextValue>(
    () => ({
      language,
      theme,
      setLanguage(nextLanguage) {
        setLanguageState(nextLanguage);
        saveLanguagePreference(nextLanguage);
      },
      setTheme(nextTheme) {
        setThemeState(nextTheme);
        saveThemePreference(nextTheme);
      },
      t(key) {
        return translations[language][key];
      },
    }),
    [language, theme],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences(): UiPreferencesContextValue {
  const value = useContext(UiPreferencesContext);

  if (value === null) {
    return defaultUiPreferences;
  }

  return value;
}

export function loadLanguagePreference(storage: Storage = localStorage): Language {
  const storedLanguage = storage.getItem(UI_LANGUAGE_STORAGE_KEY);

  return isLanguage(storedLanguage) ? storedLanguage : 'he';
}

export function loadThemePreference(storage: Storage = localStorage): ThemeMode {
  const storedTheme = storage.getItem(UI_THEME_STORAGE_KEY);

  return isThemeMode(storedTheme) ? storedTheme : 'light';
}

export function saveLanguagePreference(language: Language, storage: Storage = localStorage): void {
  storage.setItem(UI_LANGUAGE_STORAGE_KEY, language);
}

export function saveThemePreference(theme: ThemeMode, storage: Storage = localStorage): void {
  storage.setItem(UI_THEME_STORAGE_KEY, theme);
}

export function applyUiPreferencesToDocument(
  root: Pick<HTMLElement, 'lang' | 'dir' | 'dataset'>,
  language: Language,
  theme: ThemeMode,
): void {
  root.lang = language;
  root.dir = languageDirections[language];
  root.dataset.theme = theme;
}

const defaultUiPreferences: UiPreferencesContextValue = {
  language: 'he',
  theme: 'light',
  setLanguage: () => undefined,
  setTheme: () => undefined,
  t(key) {
    return translations.he[key];
  },
};
