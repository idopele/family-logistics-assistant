import type { ReactNode } from 'react';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import type { Child, EventCategory } from '../models';

export type ChildFilter = 'all' | string;
export type CategoryFilter =
  | 'all'
  | Extract<
      EventCategory,
      | 'school'
      | 'basketball'
      | 'dance'
      | 'doctor'
      | 'parentMeeting'
      | 'performance'
      | 'openPractice'
      | 'privateLesson'
      | 'work'
      | 'friends'
      | 'meal'
      | 'other'
    >;

interface ScheduleFiltersProps {
  children: Child[];
  childFilter: ChildFilter;
  categoryFilter: CategoryFilter;
  showOnlyWithTransportation: boolean;
  onChildFilterChange: (filter: ChildFilter) => void;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
  onShowOnlyWithTransportationChange: (value: boolean) => void;
}

const categoryFilterValues: CategoryFilter[] = [
  'all',
  'school',
  'basketball',
  'dance',
  'doctor',
  'parentMeeting',
  'performance',
  'openPractice',
  'privateLesson',
  'work',
  'friends',
  'meal',
  'other',
];

export function ScheduleFilters({
  children,
  childFilter,
  categoryFilter,
  showOnlyWithTransportation,
  onChildFilterChange,
  onCategoryFilterChange,
  onShowOnlyWithTransportationChange,
}: ScheduleFiltersProps) {
  const { language, t } = useUiPreferences();

  return (
    <section className="schedule-filters" aria-label={t('filters')}>
      <FilterGroup label={t('childFilter')}>
        {[{ id: 'all', name: t('all') }, ...children].map((filter) => (
          <button
            className="schedule-filters__button"
            type="button"
            aria-pressed={childFilter === filter.id}
            key={filter.id}
            onClick={() => onChildFilterChange(filter.id)}
          >
            {filter.name}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label={t('activityTypeFilter')}>
        {categoryFilterValues.map((filter) => (
          <button
            className="schedule-filters__button"
            type="button"
            aria-pressed={categoryFilter === filter}
            key={filter}
            onClick={() => onCategoryFilterChange(filter)}
          >
            {filter === 'all' ? t('all') : getEventCategoryLabel({ category: filter, customCategoryLabel: null }, language)}
          </button>
        ))}
      </FilterGroup>
      <label className="transportation-filter-toggle">
        <input
          type="checkbox"
          checked={showOnlyWithTransportation}
          onChange={(event) => onShowOnlyWithTransportationChange(event.target.checked)}
        />
        <span>{t('onlyTransportation')}</span>
      </label>
    </section>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="schedule-filters__group">
      <span className="schedule-filters__label">{label}</span>
      <div className="schedule-filters__buttons">{children}</div>
    </div>
  );
}
