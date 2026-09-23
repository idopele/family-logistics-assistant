import { useMemo, useState, type CSSProperties } from 'react';
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
type ActivityCategoryFilter = Exclude<CategoryFilter, 'all'>;

interface ScheduleFiltersProps {
  children: Child[];
  selectedMemberIds: string[];
  selectedCategories: EventCategory[];
  availableCategoryFilters?: CategoryFilter[];
  categoryRankOccurrences?: ScheduleOccurrence[];
  showOnlyWithTransportation: boolean;
  onMemberSelectionChange: (memberIds: string[]) => void;
  onCategorySelectionChange: (categories: EventCategory[]) => void;
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

const maxCompactCategoryCount = 3;
const maxCompactMemberCount = 4;

export function getRankedCategoryFilters(
  occurrences: Pick<ScheduleOccurrence, 'category'>[],
  selectedCategories: EventCategory[],
  isExpanded: boolean,
  availableCategoryFilters: CategoryFilter[] = categoryFilterValues,
): ActivityCategoryFilter[] {
  const occurrenceCounts = new Map<CategoryFilter, number>();

  for (const occurrence of occurrences) {
    if (isCategoryFilter(occurrence.category)) {
      const category = occurrence.category as CategoryFilter;
      occurrenceCounts.set(category, (occurrenceCounts.get(category) ?? 0) + 1);
    }
  }

  const rankedCategories = categoryFilterValues
    .filter((category): category is ActivityCategoryFilter => category !== 'all')
    .filter((category) => availableCategoryFilters.includes(category))
    .sort((first, second) => {
      const countDifference = (occurrenceCounts.get(second) ?? 0) - (occurrenceCounts.get(first) ?? 0);

      if (countDifference !== 0) {
        return countDifference;
      }

      return categoryFilterValues.indexOf(first) - categoryFilterValues.indexOf(second);
    });

  if (isExpanded) {
    return rankedCategories;
  }

  const visibleCategories = rankedCategories.slice(0, maxCompactCategoryCount);

  for (const selectedCategory of selectedCategories) {
    if (isCategoryFilter(selectedCategory) && !visibleCategories.includes(selectedCategory)) {
      visibleCategories.push(selectedCategory);
    }
  }

  return visibleCategories;
}

export function ScheduleFilters({
  children,
  selectedMemberIds,
  selectedCategories,
  availableCategoryFilters = categoryFilterValues,
  categoryRankOccurrences = [],
  showOnlyWithTransportation,
  onMemberSelectionChange,
  onCategorySelectionChange,
  onShowOnlyWithTransportationChange,
}: ScheduleFiltersProps) {
  const { language, t } = useUiPreferences();
  const [areMoreCategoriesVisible, setAreMoreCategoriesVisible] = useState(false);
  const [areMoreMembersVisible, setAreMoreMembersVisible] = useState(false);
  const authorizedMemberIds = useMemo(() => children.map((child) => child.id), [children]);
  const authorizedCategories = useMemo<ActivityCategoryFilter[]>(
    () => availableCategoryFilters.filter((category): category is ActivityCategoryFilter => category !== 'all'),
    [availableCategoryFilters],
  );
  const selectedMemberSet = useMemo(() => new Set(selectedMemberIds), [selectedMemberIds]);
  const selectedCategorySet = useMemo(() => new Set(selectedCategories), [selectedCategories]);
  const visibleMembers = useMemo(() => {
    const selected = children.filter((child) => selectedMemberSet.has(child.id));
    const ranked = [
      ...selected,
      ...children.filter((child) => !selectedMemberSet.has(child.id)),
    ];

    return areMoreMembersVisible ? ranked : ranked.slice(0, maxCompactMemberCount);
  }, [areMoreMembersVisible, children, selectedMemberSet]);
  const visibleCategoryFilters = useMemo(
    () =>
      getRankedCategoryFilters(categoryRankOccurrences, selectedCategories, areMoreCategoriesVisible, availableCategoryFilters),
    [areMoreCategoriesVisible, availableCategoryFilters, selectedCategories, categoryRankOccurrences],
  );
  const hasMemberOverflow = children.length > maxCompactMemberCount;
  const hasCategoryOverflow = authorizedCategories.length > maxCompactCategoryCount;
  const areAllMembersSelected = selectedMemberIds.length === authorizedMemberIds.length;

  function toggleMember(memberId: string) {
    onMemberSelectionChange(toggleSelection(selectedMemberIds, memberId, authorizedMemberIds));
  }

  function toggleCategory(category: EventCategory) {
    onCategorySelectionChange(toggleSelection(selectedCategories, category, authorizedCategories));
  }

  return (
    <section className="schedule-filters" aria-label={t('filters')}>
      <div className="schedule-filters__compact-group" data-filter-group="members">
        <span className="schedule-filters__label">{t('members')}</span>
        <div className="schedule-filters__chips">
          <button
            className="schedule-filters__button schedule-filters__button--all"
            type="button"
            aria-pressed={areAllMembersSelected}
            data-selected={areAllMembersSelected ? 'true' : 'false'}
            onClick={() => onMemberSelectionChange(authorizedMemberIds)}
          >
            <span aria-hidden="true">{areAllMembersSelected ? '✓' : ''}</span>
            {t('all')}
          </button>
          {visibleMembers.map((filter) => (
          <button
            className="schedule-filters__button schedule-filters__button--person"
            type="button"
            aria-pressed={selectedMemberSet.has(filter.id)}
            data-selected={selectedMemberSet.has(filter.id) ? 'true' : 'false'}
            key={filter.id}
            style={{ '--person-color': filter.color } as CSSProperties}
            onClick={() => toggleMember(filter.id)}
          >
            <span className="schedule-filters__check" aria-hidden="true">{selectedMemberSet.has(filter.id) ? '✓' : ''}</span>
            <span className="schedule-filters__person-avatar" aria-hidden="true">
              {filter.name.trim().charAt(0)}
            </span>
            <span>{filter.name}</span>
          </button>
          ))}
          {hasMemberOverflow ? (
            <button
              className="schedule-filters__button schedule-filters__button--more"
              type="button"
              aria-expanded={areMoreMembersVisible}
              onClick={() => setAreMoreMembersVisible((isVisible) => !isVisible)}
            >
              {areMoreMembersVisible ? t('showLess') : `+${children.length - Math.min(children.length, maxCompactMemberCount)}`}
            </button>
          ) : null}
        </div>
      </div>
      <div className="schedule-filters__compact-group" data-filter-group="activity">
        <span className="schedule-filters__label">{t('activitiesFilter')}</span>
        <div className="schedule-filters__chips">
          {visibleCategoryFilters.map((filter) => (
          <button
            className="schedule-filters__button"
            type="button"
            aria-pressed={selectedCategorySet.has(filter)}
            key={filter}
            onClick={() => toggleCategory(filter)}
          >
            {getEventCategoryLabel({ category: filter, customCategoryLabel: null }, language)}
          </button>
          ))}
          {hasCategoryOverflow ? (
          <button
            className="schedule-filters__button schedule-filters__button--more"
            type="button"
            aria-expanded={areMoreCategoriesVisible}
            onClick={() => setAreMoreCategoriesVisible((isVisible) => !isVisible)}
          >
            {areMoreCategoriesVisible ? t('showLess') : t('moreActivities')}
          </button>
          ) : null}
        </div>
        {areMoreCategoriesVisible ? (
          <div className="schedule-filters__popover">
            <div className="schedule-filters__popover-actions">
              <button type="button" onClick={() => onCategorySelectionChange(authorizedCategories)}>{t('selectAll')}</button>
              <button type="button" onClick={() => onCategorySelectionChange([])}>{t('clear')}</button>
            </div>
            {authorizedCategories.map((category) => (
              <label key={category}>
                <input
                  type="checkbox"
                  checked={selectedCategorySet.has(category)}
                  onChange={() => toggleCategory(category)}
                />
                {getEventCategoryLabel({ category, customCategoryLabel: null }, language)}
              </label>
            ))}
          </div>
        ) : null}
      </div>
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

function isCategoryFilter(value: EventCategory): value is ActivityCategoryFilter {
  return categoryFilterValues.includes(value as CategoryFilter);
}

function toggleSelection<T extends string>(selectedValues: T[], value: T, authorizedValues: T[]): T[] {
  const selectedSet = new Set(selectedValues);

  if (selectedSet.has(value)) {
    selectedSet.delete(value);
  } else {
    selectedSet.add(value);
  }

  const nextSelection = authorizedValues.filter((authorizedValue) => selectedSet.has(authorizedValue));

  return nextSelection.length > 0 ? nextSelection : authorizedValues;
}
