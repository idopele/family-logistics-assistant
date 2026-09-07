import { useMemo, useState } from 'react';
import { AddChildDialog } from '../components/AddChildDialog';
import { AddEventDialog } from '../components/AddEventDialog';
import { DaySchedule } from '../components/DaySchedule';
import { DeleteEventDialog } from '../components/DeleteEventDialog';
import { EventDetailsDialog } from '../components/EventDetailsDialog';
import { OccurrenceEditDialog } from '../components/OccurrenceEditDialog';
import { ScheduleFilters, type CategoryFilter, type ChildFilter } from '../components/ScheduleFilters';
import { WeekNavigation } from '../components/WeekNavigation';
import { children as seedChildren } from '../data/children';
import { eventExceptions } from '../data/eventExceptions';
import { events } from '../data/events';
import type { Child, Event, EventException, ScheduleOccurrence } from '../models';
import { loadCustomChildren, saveCustomChildren } from '../services/localChildStorage';
import { deleteCustomEvent, loadCustomEvents, saveCustomEvents, updateCustomEvent } from '../services/localEventStorage';
import {
  deleteCustomEventExceptionsForEvent,
  loadCustomEventExceptions,
  saveCustomEventExceptions,
  upsertCustomEventException,
} from '../services/localEventExceptionStorage';
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

type PendingConfirmation =
  | { type: 'deleteEvent'; eventId: string }
  | { type: 'cancelOccurrence'; occurrence: ScheduleOccurrence }
  | { type: 'deleteSeries'; eventId: string }
  | null;

export function HomePage() {
  const today = useMemo(() => getTodayDateString(), []);
  const [weekStartDate, setWeekStartDate] = useState(() => getSundayOfWeek(today));
  const [childFilter, setChildFilter] = useState<ChildFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<ScheduleOccurrence | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [occurrenceToEdit, setOccurrenceToEdit] = useState<ScheduleOccurrence | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [customEvents, setCustomEvents] = useState<Event[]>(() => loadCustomEvents());
  const [customEventExceptions, setCustomEventExceptions] = useState<EventException[]>(() => loadCustomEventExceptions());
  const [customChildren, setCustomChildren] = useState<Child[]>(() => loadCustomChildren());
  const weekDays = useMemo(() => getWorkWeekDays(weekStartDate), [weekStartDate]);
  const activeChildren = useMemo(() => [...seedChildren, ...customChildren].filter((child) => child.isActive), [customChildren]);
  const childrenById = useMemo(() => new Map(activeChildren.map((child) => [child.id, child])), [activeChildren]);
  const allEvents = useMemo(() => [...events, ...customEvents], [customEvents]);
  const allEventExceptions = useMemo(
    () => [...eventExceptions, ...customEventExceptions],
    [customEventExceptions],
  );
  const editableEventIds = useMemo(() => new Set(customEvents.map((event) => event.id)), [customEvents]);
  const customRecurringEventIds = useMemo(
    () => new Set(customEvents.filter((event) => event.recurrence !== null).map((event) => event.id)),
    [customEvents],
  );
  const selectedCustomEvent = useMemo(
    () => customEvents.find((event) => event.id === selectedOccurrence?.eventId) ?? null,
    [customEvents, selectedOccurrence],
  );
  const confirmationEvent = useMemo(() => {
    if (pendingConfirmation?.type !== 'deleteEvent' && pendingConfirmation?.type !== 'deleteSeries') {
      return null;
    }

    return customEvents.find((event) => event.id === pendingConfirmation.eventId) ?? null;
  }, [customEvents, pendingConfirmation]);
  const weekOccurrences = useMemo(() => {
    const weekEndDate = weekDays[weekDays.length - 1]?.date ?? weekStartDate;

    return getOccurrencesForRange(allEvents, allEventExceptions, weekStartDate, weekEndDate).filter((occurrence) => {
      const matchesChild = childFilter === 'all' || occurrence.childId === childFilter;
      const matchesCategory = categoryFilter === 'all' || occurrence.category === categoryFilter;

      return matchesChild && matchesCategory;
    });
  }, [allEventExceptions, allEvents, categoryFilter, childFilter, weekDays, weekStartDate]);

  function handleSaveCustomEvent(event: Event) {
    const nextCustomEvents = [...customEvents, event];

    setCustomEvents(nextCustomEvents);
    saveCustomEvents(nextCustomEvents);
    setIsAddEventOpen(false);
  }

  function handleSaveEditedEvent(event: Event) {
    const nextCustomEvents = updateCustomEvent(customEvents, event);

    setCustomEvents(nextCustomEvents);
    saveCustomEvents(nextCustomEvents);
    setEventToEdit(null);
    setSelectedOccurrence(null);
  }

  function handleSaveCustomChild(child: Child) {
    const nextCustomChildren = [...customChildren, child];

    setCustomChildren(nextCustomChildren);
    saveCustomChildren(nextCustomChildren);
    setIsAddChildOpen(false);
  }

  function handleEditSelectedEvent() {
    if (selectedCustomEvent === null) {
      return;
    }

    setEventToEdit(selectedCustomEvent);
    setSelectedOccurrence(null);
  }

  function handleEditSelectedOccurrence() {
    setOccurrenceToEdit(selectedOccurrence);
    setSelectedOccurrence(null);
  }

  function handleCancelSelectedOccurrence() {
    if (selectedOccurrence === null) {
      return;
    }

    setPendingConfirmation({ type: 'cancelOccurrence', occurrence: selectedOccurrence });
    setSelectedOccurrence(null);
  }

  function handleDeleteSelectedEvent() {
    if (selectedCustomEvent === null) {
      return;
    }

    setPendingConfirmation({ type: 'deleteEvent', eventId: selectedCustomEvent.id });
    setSelectedOccurrence(null);
  }

  function handleDeleteSelectedSeries() {
    if (selectedCustomEvent === null) {
      return;
    }

    setPendingConfirmation({ type: 'deleteSeries', eventId: selectedCustomEvent.id });
    setSelectedOccurrence(null);
  }

  function handleSaveOccurrenceException(exception: EventException) {
    const nextExceptions = upsertCustomEventException(customEventExceptions, exception);

    setCustomEventExceptions(nextExceptions);
    saveCustomEventExceptions(nextExceptions);
    setOccurrenceToEdit(null);
  }

  function handleConfirmAction() {
    if (pendingConfirmation === null) {
      return;
    }

    if (pendingConfirmation.type === 'cancelOccurrence') {
      const exception: EventException = {
        id: `exception-${pendingConfirmation.occurrence.eventId}-${pendingConfirmation.occurrence.date}`,
        eventId: pendingConfirmation.occurrence.eventId,
        date: pendingConfirmation.occurrence.date,
        type: 'cancelled',
      };
      const nextExceptions = upsertCustomEventException(customEventExceptions, exception);

      setCustomEventExceptions(nextExceptions);
      saveCustomEventExceptions(nextExceptions);
      setPendingConfirmation(null);
      return;
    }

    const nextCustomEvents = deleteCustomEvent(customEvents, pendingConfirmation.eventId);
    const nextExceptions =
      pendingConfirmation.type === 'deleteSeries'
        ? deleteCustomEventExceptionsForEvent(customEventExceptions, pendingConfirmation.eventId)
        : customEventExceptions;

    setCustomEvents(nextCustomEvents);
    saveCustomEvents(nextCustomEvents);
    setCustomEventExceptions(nextExceptions);
    saveCustomEventExceptions(nextExceptions);
    setPendingConfirmation(null);
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
            editableEventIds={editableEventIds}
            customRecurringEventIds={customRecurringEventIds}
            onCustomEventSelect={setSelectedOccurrence}
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
      <AddEventDialog
        isOpen={eventToEdit !== null}
        children={activeChildren}
        eventToEdit={eventToEdit}
        onClose={() => setEventToEdit(null)}
        onSave={handleSaveEditedEvent}
      />
      <OccurrenceEditDialog
        occurrence={occurrenceToEdit}
        onClose={() => setOccurrenceToEdit(null)}
        onSave={handleSaveOccurrenceException}
      />
      <AddChildDialog isOpen={isAddChildOpen} onClose={() => setIsAddChildOpen(false)} onSave={handleSaveCustomChild} />
      <EventDetailsDialog
        event={selectedCustomEvent}
        occurrence={selectedOccurrence}
        child={selectedCustomEvent === null ? null : childrenById.get(selectedCustomEvent.childId) ?? null}
        onClose={() => setSelectedOccurrence(null)}
        onEdit={handleEditSelectedEvent}
        onDelete={handleDeleteSelectedEvent}
        onEditOccurrence={handleEditSelectedOccurrence}
        onCancelOccurrence={handleCancelSelectedOccurrence}
        onEditSeries={handleEditSelectedEvent}
        onDeleteSeries={handleDeleteSelectedSeries}
      />
      <DeleteEventDialog
        event={confirmationEvent}
        title={pendingConfirmation?.type === 'deleteSeries' ? 'למחוק את כל הסדרה?' : 'למחוק את האירוע?'}
        message={
          pendingConfirmation?.type === 'deleteSeries'
            ? 'הפעולה תמחק את האירוע החוזר ואת כל השינויים למופעים שלו.'
            : undefined
        }
        confirmLabel={pendingConfirmation?.type === 'deleteSeries' ? 'מחק את כל הסדרה' : 'מחק'}
        pendingOccurrence={pendingConfirmation?.type === 'cancelOccurrence' ? pendingConfirmation.occurrence : null}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={handleConfirmAction}
      />
    </main>
  );
}
