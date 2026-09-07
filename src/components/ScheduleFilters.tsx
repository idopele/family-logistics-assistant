import type { ReactNode } from 'react';
import type { EventCategory } from '../models';

export type ChildFilter = 'all' | 'daniel' | 'emanuel';
export type CategoryFilter = 'all' | Extract<EventCategory, 'school' | 'basketball' | 'dance' | 'doctor'>;

interface ScheduleFiltersProps {
  childFilter: ChildFilter;
  categoryFilter: CategoryFilter;
  onChildFilterChange: (filter: ChildFilter) => void;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
}

const childFilters: Array<{ value: ChildFilter; label: string }> = [
  { value: 'all', label: 'הכל' },
  { value: 'daniel', label: 'דניאל' },
  { value: 'emanuel', label: 'עמנואל' },
];

const categoryFilters: Array<{ value: CategoryFilter; label: string }> = [
  { value: 'all', label: 'הכל' },
  { value: 'school', label: 'בית ספר' },
  { value: 'basketball', label: 'כדורסל' },
  { value: 'dance', label: 'ריקוד' },
  { value: 'doctor', label: 'רופא' },
];

export function ScheduleFilters({
  childFilter,
  categoryFilter,
  onChildFilterChange,
  onCategoryFilterChange,
}: ScheduleFiltersProps) {
  return (
    <section className="schedule-filters" aria-label="מסנני לו״ז">
      <FilterGroup label="ילד:">
        {childFilters.map((filter) => (
          <button
            className="schedule-filters__button"
            type="button"
            aria-pressed={childFilter === filter.value}
            key={filter.value}
            onClick={() => onChildFilterChange(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label="סוג פעילות:">
        {categoryFilters.map((filter) => (
          <button
            className="schedule-filters__button"
            type="button"
            aria-pressed={categoryFilter === filter.value}
            key={filter.value}
            onClick={() => onCategoryFilterChange(filter.value)}
          >
            {filter.label}
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
