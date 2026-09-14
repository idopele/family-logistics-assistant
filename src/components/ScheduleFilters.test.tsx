import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { children as seedChildren } from '../data/children';
import { translations } from '../i18n';
import { HomePage } from '../pages/HomePage';
import type { ScheduleOccurrence } from '../models';
import { ScheduleFilters, getRankedCategoryFilters } from './ScheduleFilters';

function occurrence(
  category: ScheduleOccurrence['category'],
  date = '2026-09-08',
): Pick<ScheduleOccurrence, 'category' | 'date'> {
  return { category, date };
}

function renderFilters(props: Partial<Parameters<typeof ScheduleFilters>[0]> = {}) {
  return renderToStaticMarkup(
    <ScheduleFilters
      children={[]}
      selectedMemberIds={[]}
      selectedCategories={[]}
      categoryRankOccurrences={[]}
      showOnlyWithTransportation={false}
      onMemberSelectionChange={() => undefined}
      onCategorySelectionChange={() => undefined}
      onShowOnlyWithTransportationChange={() => undefined}
      {...props}
    />,
  );
}

describe('ScheduleFilters compact activity ranking', () => {
  it('orders top activity categories by occurrence count', () => {
    const filters = getRankedCategoryFilters(
      [
        occurrence('doctor'),
        occurrence('basketball'),
        occurrence('doctor'),
        occurrence('school'),
        occurrence('school'),
        occurrence('school'),
      ] as ScheduleOccurrence[],
      [],
      false,
    );

    expect(filters.slice(0, 3)).toEqual(['school', 'doctor', 'basketball']);
  });

  it('supports single-date ranking from that date', () => {
    const visibleDateOccurrences = [occurrence('dance'), occurrence('dance'), occurrence('doctor')] as ScheduleOccurrence[];

    expect(getRankedCategoryFilters(visibleDateOccurrences, [], false).slice(0, 2)).toEqual(['dance', 'doctor']);
  });

  it('supports full-week ranking from current week occurrences', () => {
    const weekOccurrences = [
      occurrence('basketball', '2026-09-06'),
      occurrence('basketball', '2026-09-07'),
      occurrence('school', '2026-09-08'),
    ] as ScheduleOccurrence[];

    expect(getRankedCategoryFilters(weekOccurrences, [], false).slice(0, 2)).toEqual(['basketball', 'school']);
  });

  it('keeps a selected hidden category visible in compact mode', () => {
    const ranked = getRankedCategoryFilters(
      [
        occurrence('school'),
        occurrence('basketball'),
        occurrence('dance'),
        occurrence('doctor'),
        occurrence('meal'),
      ] as ScheduleOccurrence[],
      ['work'],
      false,
    );

    expect(ranked).toContain('work');
  });

  it('More reveals remaining categories and Show less collapses them', () => {
    const compact = getRankedCategoryFilters([occurrence('school')] as ScheduleOccurrence[], [], false);
    const expanded = getRankedCategoryFilters([occurrence('school')] as ScheduleOccurrence[], [], true);

    expect(compact.length).toBeLessThan(expanded.length);
    expect(expanded).toContain('other');
    expect(compact).not.toContain('other');
  });

  it('renders More in compact mode', () => {
    const markup = renderFilters();

    expect(markup).toContain(translations.he.moreActivities);
  });

  it('limits activity options to authorized categories', () => {
    const markup = renderFilters({
      selectedCategories: ['doctor'],
      availableCategoryFilters: ['all', 'doctor'],
      categoryRankOccurrences: [occurrence('doctor'), occurrence('school')] as ScheduleOccurrence[],
    });

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).not.toContain('School');
  });
});

describe('compact dashboard terminology and family-member presentation', () => {
  it('removes the large family schedule heading from HomePage markup', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
    vi.stubGlobal('localStorage', storage);

    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain('Family Logistics Assistant');
    expect(markup).not.toContain('The family schedule');
    vi.unstubAllGlobals();
  });

  it('uses family-member terminology in English for member creation', () => {
    expect(translations.en.addChild).toBe('+ Add family member');
    expect(translations.en.addChildTitle).toBe('Add family member');
  });

  it('keeps existing internal child ids and seed colors unchanged', () => {
    expect(seedChildren.map((child) => child.id)).toEqual(['daniel', 'emanuel']);
    expect(seedChildren.map((child) => child.color)).toEqual(['#2563EB', '#DB2777']);
  });

  it('renders stable configured colors for family-member chips', () => {
    const markup = renderFilters({
      children: [{ id: 'yonti', name: 'Yonti', color: '#0F766E', isActive: true }],
      selectedMemberIds: ['yonti'],
    });

    expect(markup).toContain('--person-color:#0F766E');
    expect(markup).toContain('Y');
  });

  it('uses workspace-neutral member filter terminology', () => {
    const markup = renderFilters();

    expect(translations.en.members).toBe('Members');
    expect(markup).toContain(translations.he.members);
    expect(markup).not.toContain('Children');
  });
});
