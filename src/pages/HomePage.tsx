import { useMemo, useState } from 'react';
import { AddChildDialog } from '../components/AddChildDialog';
import { AddEventDialog } from '../components/AddEventDialog';
import { DaySchedule } from '../components/DaySchedule';
import { DeleteEventDialog } from '../components/DeleteEventDialog';
import { EventDetailsDialog } from '../components/EventDetailsDialog';
import { OccurrenceEditDialog } from '../components/OccurrenceEditDialog';
import { ScheduleFilters, type CategoryFilter, type ChildFilter } from '../components/ScheduleFilters';
import { TransportationDialog } from '../components/TransportationDialog';
import { WeekNavigation } from '../components/WeekNavigation';
import { children as seedChildren } from '../data/children';
import { eventExceptions } from '../data/eventExceptions';
import { events } from '../data/events';
import type { Child, Event, EventException, ScheduleOccurrence, TransportationPlan } from '../models';
import { loadCustomChildren, saveCustomChildren } from '../services/localChildStorage';
import { deleteCustomEvent, loadCustomEvents, saveCustomEvents, updateCustomEvent } from '../services/localEventStorage';
import {
  deleteCustomEventExceptionsForEvent,
  loadCustomEventExceptions,
  saveCustomEventExceptions,
  upsertCustomEventException,
} from '../services/localEventExceptionStorage';
import {
  deleteTransportationPlan,
  deleteTransportationPlansForEvent,
  getTransportationPlanForScheduleOccurrence,
  loadTransportationPlans,
  saveTransportationPlans,
  upsertTransportationPlan,
} from '../services/localTransportationStorage';
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
  const [showOnlyWithTransportation, setShowOnlyWithTransportation] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<ScheduleOccurrence | null>(null);
  const [transportationOccurrence, setTransportationOccurrence] = useState<ScheduleOccurrence | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [occurrenceToEdit, setOccurrenceToEdit] = useState<ScheduleOccurrence | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [customEvents, setCustomEvents] = useState<Event[]>(() => loadCustomEvents());
  const [customEventExceptions, setCustomEventExceptions] = useState<EventException[]>(() => loadCustomEventExceptions());
  const [transportationPlans, setTransportationPlans] = useState<TransportationPlan[]>(() => loadTransportationPlans());
  const [customChildren, setCustomChildren] = useState<Child[]>(() => loadCustomChildren());
  const weekDays = useMemo(() => getWorkWeekDays(weekStartDate), [weekStartDate]);
  const activeChildren = useMemo(() => [...seedChildren, ...customChildren].filter((child) => child.isActive), [customChildren]);
  const childrenById = useMemo(() => new Map(activeChildren.map((child) => [child.id, child])), [activeChildren]);
  const allEvents = useMemo(() => [...events, ...customEvents], [customEvents]);
  const allEventExceptions = useMemo(() => [...eventExceptions, ...customEventExceptions], [customEventExceptions]);
  const editableEventIds = useMemo(() => new Set(customEvents.map((event) => event.id)), [customEvents]);
  const customRecurringEventIds = useMemo(
    () => new Set(customEvents.filter((event) => event.recurrence !== null).map((event) => event.id)),
    [customEvents],
  );
  const selectedEvent = useMemo(
    () => allEvents.find((event) => event.id === selectedOccurrence?.eventId) ?? null,
    [allEvents, selectedOccurrence],
  );
  const selectedCustomEvent = useMemo(
    () => customEvents.find((event) => event.id === selectedOccurrence?.eventId) ?? null,
    [customEvents, selectedOccurrence],
  );
  const transportationDialogPlan = useMemo(
    () =>
      transportationOccurrence === null
        ? null
        : getTransportationPlanForScheduleOccurrence(transportationPlans, transportationOccurrence),
    [transportationOccurrence, transportationPlans],
  );
  const selectedTransportationPlan = useMemo(
    () => (selectedOccurrence === null ? null : getTransportationPlanForScheduleOccurrence(transportationPlans, selectedOccurrence)),
    [selectedOccurrence, transportationPlans],
  );
  const transportationPlansByOccurrence = useMemo(() => {
    return new Map(transportationPlans.map((plan) => [getTransportationKey(plan.eventId, plan.occurrenceDate), plan]));
  }, [transportationPlans]);
  const confirmationEvent = useMemo(() => {
    if (pendingConfirmation?.type !== 'deleteEvent' && pendingConfirmation?.type !== 'deleteSeries') {
      return null;
    }

    return customEvents.find((event) => event.id === pendingConfirmation.eventId) ?? null;
  }, [customEvents, pendingConfirmation]);
  const weekAllOccurrences = useMemo(() => {
    const weekEndDate = weekDays[weekDays.length - 1]?.date ?? weekStartDate;

    return getOccurrencesForRange(allEvents, allEventExceptions, weekStartDate, weekEndDate);
  }, [allEventExceptions, allEvents, weekDays, weekStartDate]);
  const weekOccurrences = useMemo(() => {
    return weekAllOccurrences.filter((occurrence) => {
      const matchesChild = childFilter === 'all' || occurrence.childId === childFilter;
      const matchesCategory = categoryFilter === 'all' || occurrence.category === categoryFilter;
      const matchesTransportation =
        !showOnlyWithTransportation || getTransportationPlanForScheduleOccurrence(transportationPlans, occurrence) !== null;

      return matchesChild && matchesCategory && matchesTransportation;
    });
  }, [categoryFilter, childFilter, showOnlyWithTransportation, transportationPlans, weekAllOccurrences]);
  const weeklyTransportationSummary = useMemo(() => {
    const occurrenceKeys = new Set(weekAllOccurrences.map((occurrence) => getTransportationKey(occurrence.eventId, occurrence.date)));
    const plansInWeek = transportationPlans.filter((plan) => occurrenceKeys.has(getTransportationKey(plan.eventId, plan.occurrenceDate)));
    const outboundCount = plansInWeek.filter((plan) => plan.outbound !== null).length;
    const returnCount = plansInWeek.filter((plan) => plan.returnTrip !== null).length;

    return {
      outboundCount,
      returnCount,
      totalLegs: outboundCount + returnCount,
    };
  }, [transportationPlans, weekAllOccurrences]);

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

  function handleOpenTransportation() {
    setTransportationOccurrence(selectedOccurrence);
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

  function handleSaveTransportationPlan(plan: TransportationPlan) {
    const nextPlans = upsertTransportationPlan(transportationPlans, plan);

    setTransportationPlans(nextPlans);
    saveTransportationPlans(nextPlans);
    setTransportationOccurrence(null);
  }

  function handleDeleteTransportationPlan() {
    if (transportationOccurrence === null) {
      return;
    }

    const nextPlans = deleteTransportationPlan(transportationPlans, transportationOccurrence.eventId, transportationOccurrence.date);

    setTransportationPlans(nextPlans);
    saveTransportationPlans(nextPlans);
    setTransportationOccurrence(null);
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
    const nextTransportationPlans = deleteTransportationPlansForEvent(transportationPlans, pendingConfirmation.eventId);

    setCustomEvents(nextCustomEvents);
    saveCustomEvents(nextCustomEvents);
    setCustomEventExceptions(nextExceptions);
    saveCustomEventExceptions(nextExceptions);
    setTransportationPlans(nextTransportationPlans);
    saveTransportationPlans(nextTransportationPlans);
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
          showOnlyWithTransportation={showOnlyWithTransportation}
          onChildFilterChange={setChildFilter}
          onCategoryFilterChange={setCategoryFilter}
          onShowOnlyWithTransportationChange={setShowOnlyWithTransportation}
        />
        {weeklyTransportationSummary.totalLegs > 0 ? (
          <section className="transportation-week-summary" aria-label="סיכום הסעות שבועי">
            <strong>הסעות השבוע: {weeklyTransportationSummary.totalLegs}</strong>
            <span>
              הלוך: {weeklyTransportationSummary.outboundCount} · חזור: {weeklyTransportationSummary.returnCount}
            </span>
          </section>
        ) : null}
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
            transportationPlansByOccurrence={transportationPlansByOccurrence}
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
      <TransportationDialog
        occurrence={transportationOccurrence}
        child={transportationOccurrence === null ? null : childrenById.get(transportationOccurrence.childId) ?? null}
        children={activeChildren}
        existingPlan={transportationDialogPlan}
        onClose={() => setTransportationOccurrence(null)}
        onSave={handleSaveTransportationPlan}
        onDelete={handleDeleteTransportationPlan}
      />
      <AddChildDialog isOpen={isAddChildOpen} onClose={() => setIsAddChildOpen(false)} onSave={handleSaveCustomChild} />
      <EventDetailsDialog
        event={selectedEvent}
        occurrence={selectedOccurrence}
        child={selectedOccurrence === null ? null : childrenById.get(selectedOccurrence.childId) ?? null}
        transportationPlan={selectedTransportationPlan}
        canManageEvent={selectedCustomEvent !== null}
        onClose={() => setSelectedOccurrence(null)}
        onEdit={handleEditSelectedEvent}
        onDelete={handleDeleteSelectedEvent}
        onEditOccurrence={handleEditSelectedOccurrence}
        onCancelOccurrence={handleCancelSelectedOccurrence}
        onEditSeries={handleEditSelectedEvent}
        onDeleteSeries={handleDeleteSelectedSeries}
        onOpenTransportation={handleOpenTransportation}
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

function getTransportationKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}|${occurrenceDate}`;
}
