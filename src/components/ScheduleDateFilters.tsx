import { weekDayLabelsByLanguage } from '../i18n';
import { useUiPreferences } from '../i18n';
import type { SelectedWeekday } from '../utils/scheduleViewFilters';

interface ScheduleDateFiltersProps {
  selectedWeekdays: SelectedWeekday[];
  specificDate: string | null;
  onSelectedWeekdaysChange: (weekdays: SelectedWeekday[]) => void;
  onSpecificDateFilterChange: (date: string) => void;
  onClearSpecificDateFilter: () => void;
}

export function ScheduleDateFilters({
  selectedWeekdays,
  specificDate,
  onSelectedWeekdaysChange,
  onSpecificDateFilterChange,
  onClearSpecificDateFilter,
}: ScheduleDateFiltersProps) {
  const { language, t } = useUiPreferences();
  const selectedWeekdaySet = new Set(selectedWeekdays);

  function toggleWeekday(day: SelectedWeekday) {
    const nextWeekdays = selectedWeekdaySet.has(day)
      ? selectedWeekdays.filter((weekday) => weekday !== day)
      : [...selectedWeekdays, day].sort((first, second) => first - second);

    onSelectedWeekdaysChange(nextWeekdays.length > 0 ? nextWeekdays : [0, 1, 2, 3, 4, 5, 6]);
  }

  return (
    <section className="schedule-date-filters" aria-label={t('dateFilters')}>
      <div className="schedule-date-filters__weekdays">
        <span className="schedule-date-filters__label">{t('daysFilter')}</span>
        <div className="schedule-date-filters__buttons">
          {weekDayLabelsByLanguage[language].map((label, day) => (
            <button
              className="schedule-date-filters__button"
              type="button"
              aria-pressed={selectedWeekdaySet.has(day as SelectedWeekday) && specificDate === null}
              key={label}
              onClick={() => toggleWeekday(day as SelectedWeekday)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="schedule-date-filters__date">
        <span>{t('dateFilter')}</span>
        <input type="date" value={specificDate ?? ''} onChange={(event) => onSpecificDateFilterChange(event.target.value)} />
      </label>
      {specificDate !== null ? (
        <button className="schedule-date-filters__clear" type="button" onClick={onClearSpecificDateFilter}>
          {t('clearDateFilter')}
        </button>
      ) : null}
    </section>
  );
}
