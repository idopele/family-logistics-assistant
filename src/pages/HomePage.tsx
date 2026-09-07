import { useMemo, useState } from 'react';
import { AddChildDialog } from '../components/AddChildDialog';
import { AddEventDialog } from '../components/AddEventDialog';
import { DaySchedule } from '../components/DaySchedule';
import { ScheduleFilters, type CategoryFilter, type ChildFilter } from '../components/ScheduleFilters';
import { WeekNavigation } from '../components/WeekNavigation';
import { children as seedChildren } from '../data/children';
import { eventExceptions } from '../data/eventExceptions';
import { events } from '../data/events';
import type { Child, Event } from '../models';
import { loadCustomChildren, saveCustomChildren } from '../services/localChildStorage';
import { loadCustomEvents, saveCustomEvents } from '../services/localEventStorage';
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
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [customEvents, setCustomEvents] = useState<Event[]>(() => loadCustomEvents());
  const [customChildren, setCustomChildren] = useState<Child[]>(() => loadCustomChildren());
  const weekDays = useMemo(() => getWorkWeekDays(weekStartDate), [weekStartDate]);
  const activeChildren = useMemo(() => [...seedChildren, ...customChildren].filter((child) => child.isActive), [customChildren]);
  const childrenById = useMemo(() => new Map(activeChildren.map((child) => [child.id, child])), [activeChildren]);
  const allEvents = useMemo(() => [...events, ...customEvents], [customEvents]);
  const weekOccurrences = useMemo(() => {
    const weekEndDate = weekDays[weekDays.length - 1]?.date ?? weekStartDate;

    return getOccurrencesForRange(allEvents, eventExceptions, weekStartDate, weekEndDate).filter((occurrence) => {
      const matchesChild = childFilter === 'all' || occurrence.childId === childFilter;
      const matchesCategory = categoryFilter === 'all' || occurrence.category === categoryFilter;

      return matchesChild && matchesCategory;
    });
  }, [allEvents, categoryFilter, childFilter, weekDays, weekStartDate]);

  function handleSaveCustomEvent(event: Event) {
    const nextCustomEvents = [...customEvents, event];

    setCustomEvents(nextCustomEvents);
    saveCustomEvents(nextCustomEvents);
    setIsAddEventOpen(false);
  }

  function handleSaveCustomChild(child: Child) {
    const nextCustomChildren = [...customChildren, child];

    setCustomChildren(nextCustomChildren);
    saveCustomChildren(nextCustomChildren);
    setIsAddChildOpen(false);
  }

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
          children={activeChildren}
          childFilter={childFilter}
          categoryFilter={categoryFilter}
          onChildFilterChange={setChildFilter}
          onCategoryFilterChange={setCategoryFilter}
        />
        <div className="dashboard-actions">
          <button className="add-event-button" type="button" onClick={() => setIsAddEventOpen(true)}>
            + הוסף אירוע
          </button>
          <button className="add-child-button" type="button" onClick={() => setIsAddChildOpen(true)}>
            + הוסף ילד
          </button>
        </div>
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
      <AddEventDialog
        isOpen={isAddEventOpen}
        children={activeChildren}
        onClose={() => setIsAddEventOpen(false)}
        onSave={handleSaveCustomEvent}
      />
      <AddChildDialog isOpen={isAddChildOpen} onClose={() => setIsAddChildOpen(false)} onSave={handleSaveCustomChild} />
    </main>
  );
}
