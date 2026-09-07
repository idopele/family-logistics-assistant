import { useUiPreferences } from '../i18n';

interface WeekNavigationProps {
  weekLabel: string;
  onPreviousWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
}

export function WeekNavigation({ weekLabel, onPreviousWeek, onCurrentWeek, onNextWeek }: WeekNavigationProps) {
  const { t } = useUiPreferences();

  return (
    <section className="week-navigation" aria-label={t('weekNavigation')}>
      <div className="week-navigation__range" aria-live="polite">
        {weekLabel}
      </div>
      <div className="week-navigation__buttons">
        <button className="week-navigation__button" type="button" onClick={onPreviousWeek}>
          {t('previousWeek')}
        </button>
        <button className="week-navigation__button" type="button" onClick={onCurrentWeek}>
          {t('thisWeek')}
        </button>
        <button className="week-navigation__button" type="button" onClick={onNextWeek}>
          {t('nextWeek')}
        </button>
      </div>
    </section>
  );
}
