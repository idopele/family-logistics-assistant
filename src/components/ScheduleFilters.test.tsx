import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { children as seedChildren } from '../data/children';
import { translations } from '../i18n';
import { HomePage } from '../pages/HomePage';
import type { ScheduleOccurrence } from '../models';
import { ScheduleFilters, getRankedCategoryFilters } from './ScheduleFilters';

function occurrence(category: ScheduleOccurrence['category'], date = '2026-09-08'): Pick<ScheduleOccurrence, 'category' | 'date'> {
  return { category, date };
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
      'all',
      false,
    );

    expect(filters.slice(0, 4)).toEqual(['all', 'school', 'doctor', 'basketball']);
  });

  it('supports single-date ranking from that date', () => {
    const visibleDateOccurrences = [occurrence('dance'), occurrence('dance'), occurrence('doctor')] as ScheduleOccurrence[];

    expect(getRankedCategoryFilters(visibleDateOccurrences, 'all', false).slice(0, 3)).toEqual(['all', 'dance', 'doctor']);
  });

  it('supports full-week ranking from current week occurrences', () => {
    const weekOccurrences = [
      occurrence('basketball', '2026-09-06'),
      occurrence('basketball', '2026-09-07'),
      occurrence('school', '2026-09-08'),
    ] as ScheduleOccurrence[];

    expect(getRankedCategoryFilters(weekOccurrences, 'all', false).slice(0, 3)).toEqual(['all', 'basketball', 'school']);
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
      'work',
      false,
    );

    expect(ranked).toContain('work');
  });

  it('More reveals remaining categories and Show less collapses them', () => {
    const compact = getRankedCategoryFilters([occurrence('school')] as ScheduleOccurrence[], 'all', false);
    const expanded = getRankedCategoryFilters([occurrence('school')] as ScheduleOccurrence[], 'all', true);

    expect(compact.length).toBeLessThan(expanded.length);
    expect(expanded).toContain('other');
    expect(compact).not.toContain('other');
  });

  it('renders More in compact mode', () => {
    const markup = renderToStaticMarkup(
      <ScheduleFilters
        children={[]}
        childFilter="all"
        categoryFilter="all"
        categoryRankOccurrences={[]}
        showOnlyWithTransportation={false}
        onChildFilterChange={() => undefined}
        onCategoryFilterChange={() => undefined}
        onShowOnlyWithTransportationChange={() => undefined}
      />,
    );

    expect(markup).toContain('אפשרויות נוספות');
  });
});

describe('compact dashboard terminology and family-member presentation', () => {
  it('removes the large family schedule heading from HomePage markup', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 };
    vi.stubGlobal('localStorage', storage);

    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain('Family Logistics Assistant');
    expect(markup).not.toContain('הלו״ז המשפחתי');
    vi.unstubAllGlobals();
  });

  it('uses family-member terminology in Hebrew and English', () => {
    expect(translations.he.addChild).toBe('+ הוסף בן/בת משפחה');
    expect(translations.he.addChildTitle).toBe('הוסף בן/בת משפחה');
    expect(translations.en.addChild).toBe('+ Add family member');
    expect(translations.en.addChildTitle).toBe('Add family member');
  });

  it('keeps existing internal child ids and seed colors unchanged', () => {
    expect(seedChildren.map((child) => child.id)).toEqual(['daniel', 'emanuel']);
    expect(seedChildren.map((child) => child.color)).toEqual(['#2563EB', '#DB2777']);
  });

  it('renders stable configured colors for family-member chips', () => {
    const markup = renderToStaticMarkup(
      <ScheduleFilters
        children={[{ id: 'yonti', name: 'Yonti', color: '#0F766E', isActive: true }]}
        childFilter="yonti"
        categoryFilter="all"
        categoryRankOccurrences={[]}
        showOnlyWithTransportation={false}
        onChildFilterChange={() => undefined}
        onCategoryFilterChange={() => undefined}
        onShowOnlyWithTransportationChange={() => undefined}
      />,
    );

    expect(markup).toContain('--person-color:#0F766E');
    expect(markup).toContain('Y');
  });
});