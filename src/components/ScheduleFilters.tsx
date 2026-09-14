import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { getEventCategoryLabel } from '../data/eventCategories';
import { useUiPreferences } from '../i18n';
import type { Child, EventCategory, ScheduleOccurrence } from '../models';

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
  availableCategoryFilters?: CategoryFilter[];
  categoryRankOccurrences?: ScheduleOccurrence[];
  showOnlyWithTransportation: boolean;
  onChildFilterChange: (filter: ChildFilter) => void;
  onCategoryFilterChange: (filter: CategoryFilter) => void;
  onShowOnlyWithTransportationChange: (value: boolean) => void;
}

export const categoryFilterValues: CategoryFilter[] = [
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

const maxCompactCategoryCount = 5;

export function getRankedCategoryFilters(
  occurrences: Pick<ScheduleOccurrence, 'category'>[],
  selectedCategory: CategoryFilter,
  isExpanded: boolean,
): CategoryFilter[] {
  const occurrenceCounts = new Map<CategoryFilter, number>();

  for (const occurrence of occurrences) {
    if (isCategoryFilter(occurrence.category)) {
      const category = occurrence.category as CategoryFilter;
      occurrenceCounts.set(category, (occurrenceCounts.get(category) ?? 0) + 1);
    }
  }

  const rankedCategories = categoryFilterValues
    .filter((category) => category !== 'all')
    .sort((first, second) => {
      const countDifference = (occurrenceCounts.get(second) ?? 0) - (occurrenceCounts.get(first) ?? 0);

      if (countDifference !== 0) {
        return countDifference;
      }

      return categoryFilterValues.indexOf(first) - categoryFilterValues.indexOf(second);
    });

  if (isExpanded) {
    return ['all', ...rankedCategories];
  }

  const visibleCategories = rankedCategories.slice(0, maxCompactCategoryCount);

  if (selectedCategory !== 'all' && !visibleCategories.includes(selectedCategory)) {
    visibleCategories.push(selectedCategory);
  }

  return ['all', ...visibleCategories];
}

export function ScheduleFilters({
  children,
  childFilter,
  categoryFilter,
  availableCategoryFilters = categoryFilterValues,
  categoryRankOccurrences = [],
  showOnlyWithTransportation,
  onChildFilterChange,
  onCategoryFilterChange,
  onShowOnlyWithTransportationChange,
}: ScheduleFiltersProps) {
  const { language, t } = useUiPreferences();
  const [areMoreCategoriesVisible, setAreMoreCategoriesVisible] = useState(false);
  const visibleCategoryFilters = useMemo(
    () =>
      getRankedCategoryFilters(categoryRankOccurrences, categoryFilter, areMoreCategoriesVisible)
        .filter((filter) => availableCategoryFilters.includes(filter)),
    [areMoreCategoriesVisible, availableCategoryFilters, categoryFilter, categoryRankOccurrences],
  );
  const hasHiddenCategories = visibleCategoryFilters.length < availableCategoryFilters.length;

  return (
    <section className="schedule-filters" aria-label={t('filters')}>
      <FilterGroup label={t('childFilter')} variant="family">
        {[{ id: 'all', name: t('all'), color: null }, ...children].map((filter) => (
          <button
            className="schedule-filters__button schedule-filters__button--person"
            type="button"
            aria-pressed={childFilter === filter.id}
            key={filter.id}
            style={filter.color === null ? undefined : ({ '--person-color': filter.color } as CSSProperties)}
            onClick={() => onChildFilterChange(filter.id)}
          >
            {filter.color !== null ? (
              <span className="schedule-filters__person-avatar" aria-hidden="true">
                {filter.name.trim().charAt(0)}
              </span>
            ) : null}
            <span>{filter.name}</span>
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label={t('activityTypeFilter')} variant="activity">
        {visibleCategoryFilters.map((filter) => (
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
        {hasHiddenCategories ? (
          <button
            className="schedule-filters__button schedule-filters__button--more"
            type="button"
            aria-expanded={areMoreCategoriesVisible}
            onClick={() => setAreMoreCategoriesVisible(true)}
          >
            {t('moreActivityTypes')}
          </button>
        ) : (
          <button
            className="schedule-filters__button schedule-filters__button--more"
            type="button"
            aria-expanded={areMoreCategoriesVisible}
            onClick={() => setAreMoreCategoriesVisible(false)}
          >
            {t('showLess')}
          </button>
        )}
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

function FilterGroup({ label, variant, children }: { label: string; variant: 'family' | 'activity'; children: ReactNode }) {
  return (
    <div className="schedule-filters__group" data-filter-group={variant}>
      <span className="schedule-filters__label">{label}</span>
      <div className="schedule-filters__buttons">{children}</div>
    </div>
  );
}

function isCategoryFilter(value: EventCategory): boolean {
  return categoryFilterValues.includes(value as CategoryFilter);
}
