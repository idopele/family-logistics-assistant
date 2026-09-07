import type { ReactNode } from 'react';
import { eventCategories } from '../data/eventCategories';
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
  onChildFilterChange: (filter: ChildFilter) => void;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
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
  onChildFilterChange,
  onCategoryFilterChange,
}: ScheduleFiltersProps) {
  return (
    <section className="schedule-filters" aria-label="מסנני לו״ז">
      <FilterGroup label="ילד:">
        {[{ id: 'all', name: 'הכל' }, ...children].map((filter) => (
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
      <FilterGroup label="סוג פעילות:">
        {categoryFilterValues.map((filter) => (
          <button
            className="schedule-filters__button"
            type="button"
            aria-pressed={categoryFilter === filter}
            key={filter}
            onClick={() => onCategoryFilterChange(filter)}
          >
            {filter === 'all' ? 'הכל' : eventCategories[filter]}
          </button>
        ))}
      </FilterGroup>
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
