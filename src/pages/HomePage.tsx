import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddChildDialog } from '../components/AddChildDialog';
import { AddEventDialog } from '../components/AddEventDialog';
import { DaySchedule } from '../components/DaySchedule';
import { DeleteEventDialog } from '../components/DeleteEventDialog';
import { EventDetailsDialog } from '../components/EventDetailsDialog';
import { FamilyActionCenter } from '../components/FamilyActionCenter';
import { OccurrenceEditDialog } from '../components/OccurrenceEditDialog';
import { ScheduleDateFilters } from '../components/ScheduleDateFilters';
import { ScheduleFilters, type CategoryFilter, type ChildFilter } from '../components/ScheduleFilters';
import { TransportationConflicts } from '../components/TransportationConflicts';
import { TransportationDialog } from '../components/TransportationDialog';
import { UiPreferenceControls } from '../components/UiPreferenceControls';
import { WeekNavigation } from '../components/WeekNavigation';
import { children as seedChildren } from '../data/children';
import { eventExceptions } from '../data/eventExceptions';
import { events } from '../data/events';
import type { Child, Event, EventException, EventReminder, ScheduleOccurrence, TransportationPlan } from '../models';
import { deleteCustomEvent, updateCustomEvent } from '../services/localEventStorage';
import {
  deleteCustomEventExceptionsForEvent,
  upsertCustomEventException,
} from '../services/localEventExceptionStorage';
import {
  deleteTransportationPlan,
  deleteTransportationPlansForEvent,
  getTransportationPlanForScheduleOccurrence,
  upsertTransportationPlan,
} from '../services/localTransportationStorage';
import {
  deleteSharedEvent,
  deleteSharedEventReminder,
  deleteSharedTransportationPlan,
  hasLocalFamilyData,
  importLocalFamilyData,
  isLocalMigrationConfirmed,
  loadLocalFamilyDataForMigration,
  loadSharedFamilyState,
  upsertSharedChild,
  upsertSharedEvent,
  upsertSharedEventException,
  upsertSharedEventReminder,
  upsertSharedTransportationPlan,
  deleteSharedEventReminderInState,
  upsertSharedEventReminderInState,
  type LocalFamilyData,
} from '../services/sharedFamilyData';
import { getOccurrencesForRange } from '../services/scheduleEngine';
import {
  createEventReminder,
  getReminderForOccurrence,
  isReminderMinutesBefore,
  parseEventDeepLink,
  removeEventDeepLinkParams,
  resolveDeepLinkedOccurrence,
  type ReminderMinutesBefore,
} from '../services/eventReminders';
import { detectTransportationConflicts } from '../services/transportationConflictDetection';
import { buildFamilyActionCenterData } from '../services/familyActionCenter';
import { useUiPreferences } from '../i18n';
import { addDays, isValidDate } from '../utils/dateTime';
import {
  getVisibleWeekDays,
  getWeekStartForSpecificDate,
  type WeekdayFilter,
} from '../utils/scheduleViewFilters';
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

type SharedDataStatus = 'syncing' | 'shared' | 'issue';

export function HomePage() {
  const { language, t } = useUiPreferences();
  const today = useMemo(() => getTodayDateString(), []);
  const currentTime = useMemo(() => getCurrentTimeString(), []);
  const deepLinkProcessedRef = useRef(false);
  const localMigrationData = useMemo<LocalFamilyData>(() => loadLocalFamilyDataForMigration(), []);
  const currentWeekStartDate = useMemo(() => getSundayOfWeek(today), [today]);
  const [weekStartDate, setWeekStartDate] = useState(() => getSundayOfWeek(today));
  const [childFilter, setChildFilter] = useState<ChildFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [weekdayFilter, setWeekdayFilter] = useState<WeekdayFilter>('all');
  const [specificDateFilter, setSpecificDateFilter] = useState('');
  const [showOnlyWithTransportation, setShowOnlyWithTransportation] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isAddChildOpen, setIsAddChildOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<ScheduleOccurrence | null>(null);
  const [deepLinkMessage, setDeepLinkMessage] = useState<string | null>(null);
  const [transportationOccurrence, setTransportationOccurrence] = useState<ScheduleOccurrence | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [occurrenceToEdit, setOccurrenceToEdit] = useState<ScheduleOccurrence | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const [customEvents, setCustomEvents] = useState<Event[]>(() => localMigrationData.customEvents);
  const [customEventExceptions, setCustomEventExceptions] = useState<EventException[]>(() => localMigrationData.eventExceptions);
  const [transportationPlans, setTransportationPlans] = useState<TransportationPlan[]>(() => localMigrationData.transportationPlans);
  const [eventReminders, setEventReminders] = useState<EventReminder[]>(() => localMigrationData.eventReminders);
  const [customChildren, setCustomChildren] = useState<Child[]>(() => localMigrationData.customChildren);
  const [sharedDataStatus, setSharedDataStatus] = useState<SharedDataStatus>('syncing');
  const [sharedDataInitialized, setSharedDataInitialized] = useState(false);
  const [isMigrationDismissed, setIsMigrationDismissed] = useState(false);
  const [isImportingLocalData, setIsImportingLocalData] = useState(false);
  const [sharedDataError, setSharedDataError] = useState<string | null>(null);
  const weekDays = useMemo(() => getWorkWeekDays(weekStartDate, language), [language, weekStartDate]);
  const visibleWeekDays = useMemo(
    () => getVisibleWeekDays(weekDays, weekdayFilter, specificDateFilter, language),
    [language, specificDateFilter, weekDays, weekdayFilter],
  );
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
  const isSelectedCustomOneTimeEvent = selectedCustomEvent !== null && selectedCustomEvent.recurrence === null;
  const isSelectedCustomRecurringEvent = selectedCustomEvent !== null && selectedCustomEvent.recurrence !== null;
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
  const selectedReminder = useMemo(
    () => (selectedOccurrence === null ? null : getReminderForOccurrence(eventReminders, selectedOccurrence)),
    [eventReminders, selectedOccurrence],
  );
  const transportationPlansByOccurrence = useMemo(() => {
    return new Map(transportationPlans.map((plan) => [getTransportationKey(plan.eventId, plan.occurrenceDate), plan]));
  }, [transportationPlans]);
  const remindersByOccurrence = useMemo(() => {
    return new Map(
      eventReminders
        .filter((reminder) => reminder.enabled)
        .map((reminder) => [getTransportationKey(reminder.eventId, reminder.occurrenceDate), reminder]),
    );
  }, [eventReminders]);
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
  const transportationConflictOccurrences = useMemo(() => {
    const weekEndDate = weekDays[weekDays.length - 1]?.date ?? weekStartDate;

    return getOccurrencesForRange(allEvents, allEventExceptions, addDays(weekStartDate, -1), addDays(weekEndDate, 1));
  }, [allEventExceptions, allEvents, weekDays, weekStartDate]);
  const transportationConflicts = useMemo(() => {
    const weekEndDate = weekDays[weekDays.length - 1]?.date ?? weekStartDate;

    return detectTransportationConflicts(
      transportationPlans,
      transportationConflictOccurrences,
      activeChildren,
      weekStartDate,
      weekEndDate,
    );
  }, [activeChildren, transportationConflictOccurrences, transportationPlans, weekDays, weekStartDate]);
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
  const familyActionCenterData = useMemo(
    () =>
      buildFamilyActionCenterData({
        events: allEvents,
        exceptions: allEventExceptions,
        transportationPlans,
        children: activeChildren,
        today,
        currentTime,
        language,
      }),
    [activeChildren, allEventExceptions, allEvents, currentTime, language, today, transportationPlans],
  );

  const shouldShowMigrationNotice =
    !sharedDataInitialized && !isMigrationDismissed && hasLocalFamilyData(localMigrationData) && sharedDataStatus !== 'syncing';

  const refreshSharedData = useCallback(async (showSyncing = false) => {
    if (showSyncing) {
      setSharedDataStatus('syncing');
    }

    try {
      const sharedState = await loadSharedFamilyState();

      setCustomChildren(sharedState.customChildren);
      setCustomEvents(sharedState.customEvents);
      setCustomEventExceptions(sharedState.eventExceptions);
      setTransportationPlans(sharedState.transportationPlans);
      setEventReminders(sharedState.eventReminders);
      setSharedDataInitialized(sharedState.initialized);
      setSharedDataStatus('shared');
      setSharedDataError(null);

      return sharedState;
    } catch {
      setSharedDataStatus('issue');
      setSharedDataError(t('sharedDataLoadError'));

      return null;
    }
  }, [t]);

  useEffect(() => {
    void refreshSharedData(true);
  }, [refreshSharedData]);

  useEffect(() => {
    if (deepLinkProcessedRef.current || sharedDataStatus === 'syncing') {
      return;
    }

    const deepLink = parseEventDeepLink(window.location.search);

    if (deepLink === null) {
      deepLinkProcessedRef.current = true;
      return;
    }

    deepLinkProcessedRef.current = true;
    const occurrence = resolveDeepLinkedOccurrence(allEvents, allEventExceptions, deepLink.eventId, deepLink.date);

    if (occurrence === null) {
      setDeepLinkMessage(t('requestedEventNotFound'));
      clearEventDeepLinkParams();
      return;
    }

    setWeekStartDate(getWeekStartForSpecificDate(deepLink.date));
    setSelectedOccurrence(occurrence);
    setDeepLinkMessage(null);
  }, [allEventExceptions, allEvents, sharedDataStatus, t]);
  useEffect(() => {
    function handleWindowFocus() {
      void refreshSharedData();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshSharedData();
      }
    }

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshSharedData();
      }
    }, 30_000);

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [refreshSharedData]);

  async function runSharedMutation(action: () => Promise<void>): Promise<boolean> {
    setSharedDataStatus('syncing');
    setSharedDataError(null);

    try {
      await action();
      setSharedDataInitialized(true);
      setSharedDataStatus('shared');

      return true;
    } catch {
      setSharedDataStatus('issue');
      setSharedDataError(t('sharedDataSaveError'));

      return false;
    }
  }

  async function handleSaveCustomEvent(event: Event) {
    const didSave = await runSharedMutation(() => upsertSharedEvent(event));

    if (!didSave) {
      return;
    }

    setCustomEvents([...customEvents, event]);
    setIsAddEventOpen(false);
  }

  async function handleSaveEditedEvent(event: Event) {
    const didSave = await runSharedMutation(() => upsertSharedEvent(event));

    if (!didSave) {
      return;
    }

    setCustomEvents(updateCustomEvent(customEvents, event));
    setEventToEdit(null);
    setSelectedOccurrence(null);
  }

  async function handleSaveCustomChild(child: Child) {
    const didSave = await runSharedMutation(() => upsertSharedChild(child));

    if (!didSave) {
      return;
    }

    setCustomChildren([...customChildren, child]);
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
    if (selectedOccurrence === null) {
      return;
    }

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

  async function handleSaveOccurrenceException(exception: EventException) {
    const didSave = await runSharedMutation(() => upsertSharedEventException(exception));

    if (!didSave) {
      return;
    }

    setCustomEventExceptions(upsertCustomEventException(customEventExceptions, exception));
    setOccurrenceToEdit(null);
  }

  async function handleSaveTransportationPlan(plan: TransportationPlan) {
    const didSave = await runSharedMutation(() => upsertSharedTransportationPlan(plan));

    if (!didSave) {
      return;
    }

    setTransportationPlans(upsertTransportationPlan(transportationPlans, plan));
    setTransportationOccurrence(null);
  }

  async function handleDeleteTransportationPlan() {
    if (transportationOccurrence === null) {
      return;
    }

    const didSave = await runSharedMutation(() =>
      deleteSharedTransportationPlan(transportationOccurrence.eventId, transportationOccurrence.date),
    );

    if (!didSave) {
      return;
    }

    setTransportationPlans(deleteTransportationPlan(transportationPlans, transportationOccurrence.eventId, transportationOccurrence.date));
    setTransportationOccurrence(null);
  }

  async function handleReminderChange(minutesBefore: ReminderMinutesBefore | null) {
    if (selectedOccurrence === null) {
      return;
    }

    if (minutesBefore === null) {
      const didSave = await runSharedMutation(() =>
        deleteSharedEventReminder(selectedOccurrence.eventId, selectedOccurrence.date),
      );

      if (!didSave) {
        return;
      }

      setEventReminders(deleteSharedEventReminderInState(eventReminders, selectedOccurrence.eventId, selectedOccurrence.date));
      return;
    }

    if (!isReminderMinutesBefore(minutesBefore)) {
      return;
    }

    const nextReminder = createEventReminder(
      selectedOccurrence.eventId,
      selectedOccurrence.date,
      minutesBefore,
      selectedReminder,
    );
    const didSave = await runSharedMutation(() => upsertSharedEventReminder(nextReminder));

    if (!didSave) {
      return;
    }

    setEventReminders(upsertSharedEventReminderInState(eventReminders, nextReminder));
  }

  async function handleConfirmAction() {
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
      const didSave = await runSharedMutation(() => upsertSharedEventException(exception));

      if (!didSave) {
        return;
      }

      setCustomEventExceptions(upsertCustomEventException(customEventExceptions, exception));
      setPendingConfirmation(null);
      return;
    }

    const didSave = await runSharedMutation(() => deleteSharedEvent(pendingConfirmation.eventId));

    if (!didSave) {
      return;
    }

    setCustomEvents(deleteCustomEvent(customEvents, pendingConfirmation.eventId));
    setCustomEventExceptions(
      pendingConfirmation.type === 'deleteSeries'
        ? deleteCustomEventExceptionsForEvent(customEventExceptions, pendingConfirmation.eventId)
        : customEventExceptions,
    );
    setTransportationPlans(deleteTransportationPlansForEvent(transportationPlans, pendingConfirmation.eventId));
    setPendingConfirmation(null);
  }

  async function handleImportLocalData() {
    setIsImportingLocalData(true);
    const didSave = await runSharedMutation(() => importLocalFamilyData(localMigrationData));

    if (!didSave) {
      setIsImportingLocalData(false);
      return;
    }

    const sharedState = await refreshSharedData(true);

    if (sharedState !== null && isLocalMigrationConfirmed(localMigrationData, sharedState)) {
      setIsMigrationDismissed(true);
      setSharedDataInitialized(true);
    } else {
      setSharedDataStatus('issue');
      setSharedDataError(t('sharedDataImportVerifyError'));
    }

    setIsImportingLocalData(false);
  }

  function clearEventDeepLinkParams() {
    const nextSearch = removeEventDeepLinkParams(window.location.search);
    window.history.replaceState(null, '', window.location.pathname + nextSearch + window.location.hash);
  }

  function handleCloseSelectedOccurrence() {
    setSelectedOccurrence(null);
    clearEventDeepLinkParams();
  }

  function handlePreviousWeek() {
    setSpecificDateFilter('');
    setWeekStartDate(getPreviousWeekStart(weekStartDate));
  }

  function handleCurrentWeek() {
    setSpecificDateFilter('');
    setWeekStartDate(getSundayOfWeek(today));
  }

  function handleNextWeek() {
    setSpecificDateFilter('');
    setWeekStartDate(getNextWeekStart(weekStartDate));
  }

  function handleSpecificDateFilterChange(date: string) {
    setSpecificDateFilter(date);

    if (date !== '' && isValidDate(date)) {
      setWeekStartDate(getWeekStartForSpecificDate(date));
    }
  }

  return (
    <main className="dashboard-page" aria-labelledby="app-title">
      <header className="dashboard-top">
        <div className="dashboard-top__main">
          <div className="dashboard-header">
            <p>{t('appTitle')}</p>
            <h1 id="app-title">{t('appName')}</h1>
          </div>
          <div className="dashboard-time-controls">
            <WeekNavigation
              weekLabel={formatWeekRange(weekStartDate, language)}
              onPreviousWeek={handlePreviousWeek}
              onCurrentWeek={handleCurrentWeek}
              onNextWeek={handleNextWeek}
            />
            <ScheduleDateFilters
              weekdayFilter={weekdayFilter}
              specificDateFilter={specificDateFilter}
              onWeekdayFilterChange={setWeekdayFilter}
              onSpecificDateFilterChange={handleSpecificDateFilterChange}
              onClearSpecificDateFilter={() => setSpecificDateFilter('')}
            />
          </div>
          <div className="dashboard-header-tools">
            <UiPreferenceControls />
            <SharedDataStatusIndicator status={sharedDataStatus} />
            <div className="dashboard-actions">
              <button className="add-event-button" type="button" onClick={() => setIsAddEventOpen(true)}>
                {t('addEvent')}
              </button>
              <button className="add-child-button" type="button" onClick={() => setIsAddChildOpen(true)}>
                {t('addChild')}
              </button>
            </div>
          </div>
        </div>

        <ScheduleFilters
          children={activeChildren}
          childFilter={childFilter}
          categoryFilter={categoryFilter}
          showOnlyWithTransportation={showOnlyWithTransportation}
          onChildFilterChange={setChildFilter}
          onCategoryFilterChange={setCategoryFilter}
          onShowOnlyWithTransportationChange={setShowOnlyWithTransportation}
        />
        {deepLinkMessage !== null ? (
          <section className="shared-data-message" data-status="issue">
            <span>{deepLinkMessage}</span>
          </section>
        ) : null}
        {sharedDataError !== null ? (
          <section className="shared-data-message" data-status="issue">
            <span>{sharedDataError}</span>
            <button type="button" onClick={() => void refreshSharedData(true)}>
              {t('retry')}
            </button>
          </section>
        ) : null}
        {shouldShowMigrationNotice ? (
          <section className="shared-data-message" data-status="migration">
            <span>{t('localDataFound')}</span>
            <div className="shared-data-message__actions">
              <button type="button" onClick={() => void handleImportLocalData()} disabled={isImportingLocalData}>
                {isImportingLocalData ? t('syncing') : t('importData')}
              </button>
              <button type="button" onClick={() => setIsMigrationDismissed(true)}>
                {t('notNow')}
              </button>
            </div>
          </section>
        ) : null}
        {weeklyTransportationSummary.totalLegs > 0 ? (
          <section className="transportation-week-summary" aria-label={t('ridesThisWeek')}>
            <strong>
              {t('ridesThisWeek')} {weeklyTransportationSummary.totalLegs}
            </strong>
            <span>
              {t('outbound')}: {weeklyTransportationSummary.outboundCount} · {t('returnTrip')}: {weeklyTransportationSummary.returnCount}
            </span>
          </section>
        ) : null}
        <TransportationConflicts conflicts={transportationConflicts} />
      </header>

      <FamilyActionCenter
        data={familyActionCenterData}
        childrenById={childrenById}
        transportationPlansByOccurrence={transportationPlansByOccurrence}
        remindersByOccurrence={remindersByOccurrence}
        language={language}
        isViewingCurrentWeek={weekStartDate === currentWeekStartDate}
        onShowCurrentWeek={() => setWeekStartDate(currentWeekStartDate)}
        onOccurrenceSelect={setSelectedOccurrence}
      />

      <section className="weekly-schedule" aria-labelledby="weekly-schedule-title">
        <div className="weekly-schedule__header">
          <h2 id="weekly-schedule-title">{t('weekSection')}</h2>
          <span>{formatWeekRange(weekStartDate, language)}</span>
        </div>
        <div className="weekly-grid" aria-label={t('weekSection')}>
          {visibleWeekDays.map((day) => (
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
              remindersByOccurrence={remindersByOccurrence}
              language={language}
              onOccurrenceSelect={setSelectedOccurrence}
              isToday={isDateInWorkWeek(today, weekStartDate) && today === day.date}
            />
          ))}
        </div>
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
        transportationPlans={transportationPlans}
        validationOccurrences={transportationConflictOccurrences}
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
        reminder={selectedReminder}
        canEditEvent={isSelectedCustomOneTimeEvent}
        canEditOccurrence={selectedEvent !== null && !isSelectedCustomOneTimeEvent}
        canEditSeries={isSelectedCustomRecurringEvent}
        canDeleteEvent={isSelectedCustomOneTimeEvent}
        canCancelOccurrence={selectedEvent?.recurrence !== null && selectedEvent !== null}
        canDeleteSeries={isSelectedCustomRecurringEvent}
        onClose={handleCloseSelectedOccurrence}
        onEdit={handleEditSelectedEvent}
        onDelete={handleDeleteSelectedEvent}
        onEditOccurrence={handleEditSelectedOccurrence}
        onCancelOccurrence={handleCancelSelectedOccurrence}
        onEditSeries={handleEditSelectedEvent}
        onDeleteSeries={handleDeleteSelectedSeries}
        onOpenTransportation={handleOpenTransportation}
        onReminderChange={(minutesBefore) => void handleReminderChange(minutesBefore)}
      />
      <DeleteEventDialog
        event={confirmationEvent}
        title={pendingConfirmation?.type === 'deleteSeries' ? t('deleteSeriesTitle') : t('deleteTitle')}
        message={
          pendingConfirmation?.type === 'deleteSeries'
            ? t('deleteSeriesMessage')
            : undefined
        }
        confirmLabel={pendingConfirmation?.type === 'deleteSeries' ? t('deleteSeries') : t('delete')}
        pendingOccurrence={pendingConfirmation?.type === 'cancelOccurrence' ? pendingConfirmation.occurrence : null}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={handleConfirmAction}
      />
    </main>
  );
}

function SharedDataStatusIndicator({ status }: { status: SharedDataStatus }) {
  const { t } = useUiPreferences();

  return (
    <span className="shared-data-status" data-status={status}>
      {status === 'syncing' ? t('syncing') : status === 'issue' ? t('syncIssue') : t('shared')}
    </span>
  );
}

function getTransportationKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}|${occurrenceDate}`;
}

function getCurrentTimeString(): string {
  const now = new Date();

  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}
