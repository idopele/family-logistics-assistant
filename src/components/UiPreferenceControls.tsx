import { useUiPreferences } from '../i18n/UiPreferencesContext';
import type { Language, ThemeMode } from '../i18n/translations';

export function UiPreferenceControls() {
  const { language, theme, setLanguage, setTheme, t } = useUiPreferences();

  return (
    <div className="ui-preferences" aria-label={`${t('theme')} / ${t('language')}`}>
      <fieldset className="ui-preferences__group">
        <legend>{t('theme')}</legend>
        <PreferenceButton
          isSelected={theme === 'light'}
          label={t('light')}
          ariaLabel={t('switchToLight')}
          onClick={() => setTheme('light')}
        />
        <PreferenceButton
          isSelected={theme === 'dark'}
          label={t('dark')}
          ariaLabel={t('switchToDark')}
          onClick={() => setTheme('dark')}
        />
      </fieldset>
      <fieldset className="ui-preferences__group">
        <legend>{t('language')}</legend>
        <PreferenceButton
          isSelected={language === 'he'}
          label={t('hebrew')}
          ariaLabel={t('switchToHebrew')}
          onClick={() => setLanguage('he')}
        />
        <PreferenceButton
          isSelected={language === 'en'}
          label={t('english')}
          ariaLabel={t('switchToEnglish')}
          onClick={() => setLanguage('en')}
        />
      </fieldset>
    </div>
  );
}

function PreferenceButton({
  isSelected,
  label,
  ariaLabel,
  onClick,
}: {
  isSelected: boolean;
  label: string;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button className="ui-preferences__button" type="button" aria-label={ariaLabel} aria-pressed={isSelected} onClick={onClick}>
      {label}
    </button>
  );
}

export type UiLanguagePreference = Language;
export type UiThemePreference = ThemeMode;
