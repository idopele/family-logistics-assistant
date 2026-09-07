import { useMemo, useState } from 'react';
import { DaySchedule } from '../components/DaySchedule';
import { ScheduleFilters, type CategoryFilter, type ChildFilter } from '../components/ScheduleFilters';
import { WeekNavigation } from '../components/WeekNavigation';
import { children } from '../data/children';
import { eventExceptions } from '../data/eventExceptions';
import { events } from '../data/events';
import { getOccurrencesForRange } from '../services/scheduleEngine';
import {
  formatWeekRange,
  getNextWeekStart,
  getPreviousWeekStart,
  getSundayOfWeek,
  getTodayDateString,
  getWorkWeekDays,
  isDateInWorkWeek,
} from '../utils/week';

export function HomePage() {
  const today = useMemo(() => getTodayDateString(), []);
  const [weekStartDate, setWeekStartDate] = useState(() => getSundayOfWeek(today));
  const [childFilter, setChildFilter] = useState<ChildFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const weekDays = useMemo(() => getWorkWeekDays(weekStartDate), [weekStartDate]);
  const childrenById = useMemo(() => new Map(children.map((child) => [child.id, child])), []);
  const weekOccurrences = useMemo(() => {
    const weekEndDate = weekDays[weekDays.length - 1]?.date ?? weekStartDate;

    return getOccurrencesForRange(events, eventExceptions, weekStartDate, weekEndDate).filter((occurrence) => {
      const matchesChild = childFilter === 'all' || occurrence.childId === childFilter;
      const matchesCategory = categoryFilter === 'all' || occurrence.category === categoryFilter;

      return matchesChild && matchesCategory;
    });
  }, [categoryFilter, childFilter, weekDays, weekStartDate]);

  return (
    <main className="dashboard-page" aria-labelledby="app-title">
      <header className="dashboard-top">
        <div className="dashboard-header">
          <h1 id="app-title">Family Logistics Assistant</h1>
          <p>הלו״ז המשפחתי</p>
        </div>
        <WeekNavigation
          weekLabel={formatWeekRange(weekStartDate)}
          onPreviousWeek={() => setWeekStartDate(getPreviousWeekStart(weekStartDate))}
          onCurrentWeek={() => setWeekStartDate(getSundayOfWeek(today))}
          onNextWeek={() => setWeekStartDate(getNextWeekStart(weekStartDate))}
        />

        <ScheduleFilters
          childFilter={childFilter}
          categoryFilter={categoryFilter}
          onChildFilterChange={setChildFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
      </header>

      <section className="weekly-grid" aria-label="לוח שבועי">
        {weekDays.map((day) => (
          <DaySchedule
            key={day.date}
            label={day.label}
            date={day.date}
            occurrences={weekOccurrences.filter((occurrence) => occurrence.date === day.date)}
            childrenById={childrenById}
            childFilter={childFilter}
            isToday={isDateInWorkWeek(today, weekStartDate) && today === day.date}
          />
        ))}
      </section>
    </main>
  );
}
