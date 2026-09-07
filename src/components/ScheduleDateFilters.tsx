import { weekDayLabelsByLanguage } from '../i18n';
import { useUiPreferences } from '../i18n';
import type { WeekdayFilter } from '../utils/scheduleViewFilters';

interface ScheduleDateFiltersProps {
  weekdayFilter: WeekdayFilter;
  specificDateFilter: string;
  onWeekdayFilterChange: (filter: WeekdayFilter) => void;
  onSpecificDateFilterChange: (date: string) => void;
  onClearSpecificDateFilter: () => void;
}

export function ScheduleDateFilters({
  weekdayFilter,
  specificDateFilter,
  onWeekdayFilterChange,
  onSpecificDateFilterChange,
  onClearSpecificDateFilter,
}: ScheduleDateFiltersProps) {
  const { language, t } = useUiPreferences();

  return (
    <section className="schedule-date-filters" aria-label={t('dateFilters')}>
      <div className="schedule-date-filters__weekdays">
        <span className="schedule-date-filters__label">{t('weekdayFilter')}</span>
        <div className="schedule-date-filters__buttons">
          <button
            className="schedule-date-filters__button"
            type="button"
            aria-pressed={weekdayFilter === 'all'}
            onClick={() => onWeekdayFilterChange('all')}
          >
            {t('all')}
          </button>
          {weekDayLabelsByLanguage[language].map((label, day) => (
            <button
              className="schedule-date-filters__button"
              type="button"
              aria-pressed={weekdayFilter === day}
              key={label}
              onClick={() => onWeekdayFilterChange(day as WeekdayFilter)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="schedule-date-filters__date">
        <span>{t('specificDateFilter')}</span>
        <input type="date" value={specificDateFilter} onChange={(event) => onSpecificDateFilterChange(event.target.value)} />
      </label>
      {specificDateFilter !== '' ? (
        <button className="schedule-date-filters__clear" type="button" onClick={onClearSpecificDateFilter}>
          {t('clearDateFilter')}
        </button>
      ) : null}
    </section>
  );
}
