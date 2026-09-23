import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddChildDialog } from '../components/AddChildDialog';
import { AddEventDialog, type AddEventSaveResult } from '../components/AddEventDialog';
import { AppInfoButton } from '../components/AppInfoButton';
import { DaySchedule } from '../components/DaySchedule';
import { DeleteEventDialog } from '../components/DeleteEventDialog';
import { EventDetailsDialog } from '../components/EventDetailsDialog';
import { FamilyActionCenter } from '../components/FamilyActionCenter';
import { ImportScheduleDialog } from '../components/ImportScheduleDialog';
import { OccurrenceEditDialog } from '../components/OccurrenceEditDialog';
import { PwaInstallControl } from '../components/PwaInstallControl';
import { ScheduleDateFilters } from '../components/ScheduleDateFilters';
import { ScheduleFilters, categoryFilterValues, type CategoryFilter } from '../components/ScheduleFilters';
import { TransportationConflicts } from '../components/TransportationConflicts';
import { TransportationDialog } from '../components/TransportationDialog';
import { UiPreferenceControls } from '../components/UiPreferenceControls';
import { WeekNavigation } from '../components/WeekNavigation';
import { children as seedChildren } from '../data/children';
import { getEventCategoryLabel } from '../data/eventCategories';
import { eventExceptions } from '../data/eventExceptions';
import { events } from '../data/events';
import type { Child, Event, EventCategory, EventException, EventReminder, ScheduleOccurrence, TransportationPlan } from '../models';
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
  importSharedSchedule,
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
  type ScheduleImportResult,
} from '../services/sharedFamilyData';
import { getOccurrencesForRange } from '../services/scheduleEngine';
import {
  createEventReminder,
  getReminderForOccurrence,
  parseEventDeepLink,
  removeEventDeepLinkParams,
  resolveDeepLinkedOccurrence,
  saveEventWithOptionalReminder,
  type ReminderMinutesBefore,
} from '../services/eventReminders';
import { detectTransportationConflicts } from '../services/transportationConflictDetection';
import { buildFamilyActionCenterData } from '../services/familyActionCenter';
import { registerFamilyServiceWorker } from '../services/pushNotifications';
import { canEditEvent, hasPermission, isEventAuthorized } from '../services/authorization';
import { getOccurrenceParticipantIds } from '../services/eventParticipants';
import { useUiPreferences, type Language } from '../i18n';
import type { AuthSession } from '../services/authClient';
import { addDays, getDayOfWeek, isValidDate } from '../utils/dateTime';
import {
  createResetFilterState,
  filterOccurrencesForDashboard,
  getVisibleWeekDaysForSelection,
  getWeekdaysAfterClearingSpecificDate,
  getWeekStartForSpecificDate,
  sanitizeDashboardFilterState,
  type DashboardFilterState,
  type SelectedWeekday,
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

export function HomePage({ authSession, onLogout }: { authSession?: AuthSession; onLogout?: () => void } = {}) {
  const { language, t } = useUiPreferences();
  const today = useMemo(() => getTodayDateString(), []);
  const currentTime = useMemo(() => getCurrentTimeString(), []);
  const deepLinkProcessedRef = useRef(false);
  const localMigrationData = useMemo<LocalFamilyData>(() => loadLocalFamilyDataForMigration(), []);
  const currentWeekStartDate = useMemo(() => getSundayOfWeek(today), [today]);
  const [weekStartDate, setWeekStartDate] = useState(() => getSundayOfWeek(today));
  const [filters, setFilters] = useState<DashboardFilterState>(() =>
    createResetFilterState(today, getSundayOfWeek(today), [], []),
  );
  const [showOnlyWithTransportation, setShowOnlyWithTransportation] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isImportScheduleOpen, setIsImportScheduleOpen] = useState(false);
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
  const [authorization, setAuthorization] = useState(authSession?.authorization ?? null);
  const [isMigrationDismissed, setIsMigrationDismissed] = useState(false);
  const [isImportingLocalData, setIsImportingLocalData] = useState(false);
  const [sharedDataError, setSharedDataError] = useState<string | null>(null);
  const effectiveAuthorization = authorization ?? authSession?.authorization ?? null;
  const canViewSchedule = authSession === undefined || hasPermission(effectiveAuthorization, 'view_schedule');
  const canEditSchedule = authSession === undefined || hasPermission(effectiveAuthorization, 'edit_schedule');
  const canViewTransportation = authSession === undefined || hasPermission(effectiveAuthorization, 'view_transportation');
  const canEditTransportation = authSession === undefined || hasPermission(effectiveAuthorization, 'edit_transportation');
  const canReceiveNotifications = authSession === undefined || hasPermission(effectiveAuthorization, 'receive_notifications');
  const canManageFamilyMembers = authSession === undefined || hasPermission(effectiveAuthorization, 'manage_users');
  const weekDays = useMemo(() => getWorkWeekDays(weekStartDate, language), [language, weekStartDate]);
  const activeChildren = useMemo(
    () =>
      [...seedChildren, ...customChildren].filter((child) => {
        if (!child.isActive) {
          return false;
        }

        if (effectiveAuthorization === null || effectiveAuthorization.fullAccess) {
          return true;
        }

        return (
          canViewSchedule &&
          (effectiveAuthorization.scheduleScope.allMembers || effectiveAuthorization.scheduleScope.memberIds.includes(child.id))
        );
      }),
    [canViewSchedule, customChildren, effectiveAuthorization],
  );
  const authorizedMemberIds = useMemo(() => activeChildren.map((child) => child.id), [activeChildren]);
  const childrenById = useMemo(() => new Map(activeChildren.map((child) => [child.id, child])), [activeChildren]);
  const rawAllEvents = useMemo(() => [...events, ...customEvents], [customEvents]);
  const rawAllEventExceptions = useMemo(() => [...eventExceptions, ...customEventExceptions], [customEventExceptions]);
  const allEvents = useMemo(
    () => rawAllEvents.filter((event) => isEventAuthorized(effectiveAuthorization, event)),
    [effectiveAuthorization, rawAllEvents],
  );
  const visibleEventIds = useMemo(() => new Set(allEvents.map((event) => event.id)), [allEvents]);
  const allEventExceptions = useMemo(
    () => rawAllEventExceptions.filter((exception) => visibleEventIds.has(exception.eventId)),
    [rawAllEventExceptions, visibleEventIds],
  );
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
  const visibleTransportationPlans = useMemo(
    () => (canViewTransportation ? transportationPlans.filter((plan) => visibleEventIds.has(plan.eventId)) : []),
    [canViewTransportation, transportationPlans, visibleEventIds],
  );
  const visibleEventReminders = useMemo(
    () => (canReceiveNotifications ? eventReminders.filter((reminder) => visibleEventIds.has(reminder.eventId)) : []),
    [canReceiveNotifications, eventReminders, visibleEventIds],
  );
  const transportationDialogPlan = useMemo(
    () =>
      transportationOccurrence === null
        ? null
        : getTransportationPlanForScheduleOccurrence(visibleTransportationPlans, transportationOccurrence),
    [transportationOccurrence, visibleTransportationPlans],
  );
  const selectedTransportationPlan = useMemo(
    () => (selectedOccurrence === null ? null : getTransportationPlanForScheduleOccurrence(visibleTransportationPlans, selectedOccurrence)),
    [selectedOccurrence, visibleTransportationPlans],
  );
  const selectedReminder = useMemo(
    () => (selectedOccurrence === null ? null : getReminderForOccurrence(visibleEventReminders, selectedOccurrence)),
    [selectedOccurrence, visibleEventReminders],
  );
  const transportationPlansByOccurrence = useMemo(() => {
    return new Map(visibleTransportationPlans.map((plan) => [getTransportationKey(plan.eventId, plan.occurrenceDate), plan]));
  }, [visibleTransportationPlans]);
  const remindersByOccurrence = useMemo(() => {
    return new Map(
      visibleEventReminders
        .filter((reminder) => reminder.enabled)
        .map((reminder) => [getTransportationKey(reminder.eventId, reminder.occurrenceDate), reminder]),
    );
  }, [visibleEventReminders]);
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
      visibleTransportationPlans,
      transportationConflictOccurrences,
      activeChildren,
      weekStartDate,
      weekEndDate,
    );
  }, [activeChildren, transportationConflictOccurrences, visibleTransportationPlans, weekDays, weekStartDate]);
  const availableCategoryFilters = useMemo<CategoryFilter[]>(() => {
    if (effectiveAuthorization === null || effectiveAuthorization.fullAccess || effectiveAuthorization.scheduleScope.allCategories) {
      return categoryFilterValues;
    }

    return [
      'all',
      ...categoryFilterValues.filter((category) =>
        category !== 'all' && effectiveAuthorization.scheduleScope.categories.includes(category),
      ),
    ];
  }, [effectiveAuthorization]);
  const addEventCategories = useMemo<EventCategory[]>(
    () => availableCategoryFilters.filter((category) => category !== 'all') as EventCategory[],
    [availableCategoryFilters],
  );
  const authorizedCategories = addEventCategories;
  const sanitizedFilters = useMemo(
    () => sanitizeDashboardFilterState(filters, authorizedMemberIds, authorizedCategories),
    [authorizedCategories, authorizedMemberIds, filters],
  );
  const visibleWeekDays = useMemo(
    () => getVisibleWeekDaysForSelection(weekDays, sanitizedFilters.selectedWeekdays, sanitizedFilters.specificDate, language),
    [language, sanitizedFilters, weekDays],
  );
  const weekOccurrences = useMemo(() => {
    const filteredOccurrences = filterOccurrencesForDashboard(
      weekAllOccurrences,
      sanitizedFilters,
      authorizedMemberIds,
      authorizedCategories,
    );

    return filteredOccurrences.filter((occurrence) =>
      !showOnlyWithTransportation || getTransportationPlanForScheduleOccurrence(visibleTransportationPlans, occurrence) !== null,
    );
  }, [authorizedCategories, authorizedMemberIds, sanitizedFilters, showOnlyWithTransportation, visibleTransportationPlans, weekAllOccurrences]);
  const categoryRankOccurrences = useMemo(() => {
    if (sanitizedFilters.specificDate !== null && isValidDate(sanitizedFilters.specificDate)) {
      return weekAllOccurrences.filter((occurrence) => occurrence.date === sanitizedFilters.specificDate);
    }

    return weekAllOccurrences.filter((occurrence) =>
      sanitizedFilters.selectedWeekdays.includes(getDayOfWeek(occurrence.date) as SelectedWeekday),
    );
  }, [sanitizedFilters, weekAllOccurrences]);
  const weeklyTransportationSummary = useMemo(() => {
    const occurrenceKeys = new Set(weekAllOccurrences.map((occurrence) => getTransportationKey(occurrence.eventId, occurrence.date)));
    const plansInWeek = visibleTransportationPlans.filter((plan) => occurrenceKeys.has(getTransportationKey(plan.eventId, plan.occurrenceDate)));
    const outboundCount = plansInWeek.filter((plan) => plan.outbound !== null).length;
    const returnCount = plansInWeek.filter((plan) => plan.returnTrip !== null).length;

    return {
      outboundCount,
      returnCount,
      totalLegs: outboundCount + returnCount,
    };
  }, [visibleTransportationPlans, weekAllOccurrences]);
  const activeFilterSummary = useMemo(
    () =>
      buildActiveFilterSummary({
        filters: sanitizedFilters,
        authorizedMemberIds,
        authorizedCategories,
        childrenById,
        language,
      }),
    [authorizedCategories, authorizedMemberIds, childrenById, language, sanitizedFilters],
  );
  const familyActionCenterData = useMemo(
    () =>
      buildFamilyActionCenterData({
        events: allEvents,
        exceptions: allEventExceptions,
        transportationPlans: visibleTransportationPlans,
        children: activeChildren,
        today,
        currentTime,
        language,
      }),
    [activeChildren, allEventExceptions, allEvents, currentTime, language, today, visibleTransportationPlans],
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
      setAuthorization(sharedState.authorization ?? authSession?.authorization ?? null);
      setSharedDataInitialized(sharedState.initialized);
      setSharedDataStatus('shared');
      setSharedDataError(null);

      return sharedState;
    } catch {
      setSharedDataStatus('issue');
      setSharedDataError(t('sharedDataLoadError'));

      return null;
    }
  }, [authSession?.authorization, t]);

  useEffect(() => {
    void refreshSharedData(true);
  }, [refreshSharedData]);

  useEffect(() => {
    void registerFamilyServiceWorker();
  }, []);

  useEffect(() => {
    const nextFilters = sanitizeDashboardFilterState(filters, authorizedMemberIds, authorizedCategories);

    if (
      nextFilters.specificDate !== filters.specificDate ||
      nextFilters.selectedMemberIds.join('|') !== filters.selectedMemberIds.join('|') ||
      nextFilters.selectedCategories.join('|') !== filters.selectedCategories.join('|') ||
      nextFilters.selectedWeekdays.join('|') !== filters.selectedWeekdays.join('|')
    ) {
      setFilters(nextFilters);
    }
  }, [authorizedCategories, authorizedMemberIds, filters]);

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
    const rawOccurrence = resolveDeepLinkedOccurrence(rawAllEvents, rawAllEventExceptions, deepLink.eventId, deepLink.date);
    const occurrence = resolveDeepLinkedOccurrence(allEvents, allEventExceptions, deepLink.eventId, deepLink.date);

    if (occurrence === null) {
      setDeepLinkMessage(rawOccurrence === null ? t('requestedEventNotFound') : t('noPermissionToViewEvent'));
      clearEventDeepLinkParams();
      return;
    }

    setWeekStartDate(getWeekStartForSpecificDate(deepLink.date));
    setFilters((currentFilters) => ({ ...currentFilters, specificDate: deepLink.date }));
    setSelectedOccurrence(occurrence);
    setDeepLinkMessage(null);
  }, [allEventExceptions, allEvents, rawAllEventExceptions, rawAllEvents, sharedDataStatus, t]);
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

  async function handleSaveCustomEvent(event: Event, reminderMinutesBefore: ReminderMinutesBefore | null): Promise<AddEventSaveResult> {
    const result = await saveEventWithOptionalReminder({
      event,
      reminderMinutesBefore,
      saveEvent: (eventToSave) => runSharedMutation(() => upsertSharedEvent(eventToSave)),
      saveReminder: (reminderToSave) => runSharedMutation(() => upsertSharedEventReminder(reminderToSave)),
    });

    if (result.event === null) {
      return { ok: false };
    }

    const savedEvent = result.event;

    setCustomEvents((currentEvents) =>
      currentEvents.some((currentEvent) => currentEvent.id === savedEvent.id) ? currentEvents : [...currentEvents, savedEvent],
    );

    if (!result.ok) {
      return { ok: false, message: t('eventSavedReminderSaveError'), savedEvent };
    }

    const savedReminder = result.reminder;

    if (savedReminder !== null) {
      setEventReminders((currentReminders) => upsertSharedEventReminderInState(currentReminders, savedReminder));
    }

    setIsAddEventOpen(false);

    return { ok: true };
  }

  async function handleSaveEditedEvent(event: Event): Promise<AddEventSaveResult> {
    const didSave = await runSharedMutation(() => upsertSharedEvent(event));

    if (!didSave) {
      return { ok: false };
    }

    setCustomEvents(updateCustomEvent(customEvents, event));
    setEventToEdit(null);
    setSelectedOccurrence(null);

    return { ok: true };
  }

  async function handleImportSchedule(payload: Parameters<typeof importSharedSchedule>[0]): Promise<ScheduleImportResult> {
    const result = await importSharedSchedule(payload);

    await refreshSharedData(true);

    return result;
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
    if (!canEditTransportation) {
      return;
    }

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
    if (selectedOccurrence === null || !canReceiveNotifications) {
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
    setFilters({ ...filters, specificDate: null });
    setWeekStartDate(getPreviousWeekStart(weekStartDate));
  }

  function handleCurrentWeek() {
    setWeekStartDate(getSundayOfWeek(today));
    setFilters(createResetFilterState(today, getSundayOfWeek(today), authorizedMemberIds, authorizedCategories));
  }

  function handleNextWeek() {
    setFilters({ ...filters, specificDate: null });
    setWeekStartDate(getNextWeekStart(weekStartDate));
  }

  function handleSpecificDateFilterChange(date: string) {
    setFilters({ ...filters, specificDate: date === '' ? null : date });

    if (date !== '' && isValidDate(date)) {
      setWeekStartDate(getWeekStartForSpecificDate(date));
    }
  }

  function handleClearSpecificDateFilter() {
    setFilters({
      ...filters,
      specificDate: null,
      selectedWeekdays: getWeekdaysAfterClearingSpecificDate(today, weekStartDate, filters.selectedWeekdays),
    });
  }

  function handleMemberSelectionChange(selectedMemberIds: string[]) {
    setFilters({ ...filters, selectedMemberIds });
  }

  function handleCategorySelectionChange(selectedCategories: EventCategory[]) {
    setFilters({ ...filters, selectedCategories });
  }

  function handleSelectedWeekdaysChange(selectedWeekdays: SelectedWeekday[]) {
    setFilters({ ...filters, selectedWeekdays, specificDate: null });
  }

  function handleResetFilters() {
    const currentWeekStart = getSundayOfWeek(today);

    setWeekStartDate(currentWeekStart);
    setFilters(createResetFilterState(today, currentWeekStart, authorizedMemberIds, authorizedCategories));
  }

  return (
    <main className="dashboard-page" aria-labelledby="app-title">
      <header className="dashboard-top">
        <div className="dashboard-top__main">
          <div className="dashboard-header">
            <h1 id="app-title">{t('appName')}</h1>
          </div>
          <div className="dashboard-header-tools">
            <UiPreferenceControls />
            <PwaInstallControl />
            <AppInfoButton authSession={authSession} onLogout={onLogout} />
            <SharedDataStatusIndicator status={sharedDataStatus} />
            <div className="dashboard-actions">
              {canEditSchedule ? (
                <>
                  <button className="add-event-button" type="button" onClick={() => setIsAddEventOpen(true)}>
                    {t('addEvent')}
                  </button>
                  <button className="add-child-button" type="button" onClick={() => setIsImportScheduleOpen(true)}>
                    {t('importSchedule')}
                  </button>
                </>
              ) : null}
              {canManageFamilyMembers ? (
                <button className="add-child-button" type="button" onClick={() => setIsAddChildOpen(true)}>
                  {t('addChild')}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {canViewSchedule ? (
          <>
            <ScheduleFilters
              children={activeChildren}
              selectedMemberIds={sanitizedFilters.selectedMemberIds}
              selectedCategories={sanitizedFilters.selectedCategories}
              availableCategoryFilters={availableCategoryFilters}
              categoryRankOccurrences={categoryRankOccurrences}
              showOnlyWithTransportation={showOnlyWithTransportation}
              onMemberSelectionChange={handleMemberSelectionChange}
              onCategorySelectionChange={handleCategorySelectionChange}
              onShowOnlyWithTransportationChange={setShowOnlyWithTransportation}
            />
            <div className="dashboard-time-controls">
              <WeekNavigation
                weekLabel={formatWeekRange(weekStartDate, language)}
                onPreviousWeek={handlePreviousWeek}
                onCurrentWeek={handleCurrentWeek}
                onNextWeek={handleNextWeek}
              />
              <ScheduleDateFilters
                selectedWeekdays={sanitizedFilters.selectedWeekdays}
                specificDate={sanitizedFilters.specificDate}
                onSelectedWeekdaysChange={handleSelectedWeekdaysChange}
                onSpecificDateFilterChange={handleSpecificDateFilterChange}
                onClearSpecificDateFilter={handleClearSpecificDateFilter}
              />
            </div>
            <section className="active-filter-summary" aria-label={t('selectedFilters')}>
              <span>{t('showing')}: {activeFilterSummary}</span>
              <button type="button" onClick={handleResetFilters}>{t('reset')}</button>
            </section>
          </>
        ) : null}
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
        {!canViewSchedule && sharedDataStatus !== 'syncing' ? (
          <section className="shared-data-message" data-status="issue">
            <span>{t('accessNotConfigured')}</span>
            <span>{t('accessNotConfiguredHelp')}</span>
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
        onShowCurrentWeek={handleCurrentWeek}
        onOccurrenceSelect={setSelectedOccurrence}
      />

      <section className="weekly-schedule" aria-labelledby="weekly-schedule-title">
        <div className="weekly-schedule__header">
          <h2 id="weekly-schedule-title">{t('weekSection')}</h2>
          <span>{formatWeekRange(weekStartDate, language)}</span>
        </div>
        {canViewSchedule && weekOccurrences.length === 0 ? (
          <p className="weekly-schedule__empty-filter">{t('noEventsMatchFilters')}</p>
        ) : null}
        <div className="weekly-grid" aria-label={t('weekSection')}>
          {visibleWeekDays.map((day) => (
            <DaySchedule
              key={day.date}
              label={day.label}
              date={day.date}
              occurrences={weekOccurrences.filter((occurrence) => occurrence.date === day.date)}
              childrenById={childrenById}
              childFilter={sanitizedFilters.selectedMemberIds.length === 1 ? sanitizedFilters.selectedMemberIds[0] : 'all'}
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
        availableCategories={addEventCategories}
        onClose={() => setIsAddEventOpen(false)}
        onSave={handleSaveCustomEvent}
      />
      <ImportScheduleDialog
        isOpen={isImportScheduleOpen}
        children={activeChildren}
        availableCategories={addEventCategories}
        existingEvents={allEvents}
        onClose={() => setIsImportScheduleOpen(false)}
        onImport={handleImportSchedule}
      />
      <AddEventDialog
        isOpen={eventToEdit !== null}
        children={activeChildren}
        availableCategories={addEventCategories}
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
        participantNames={selectedOccurrence === null ? [] : getOccurrenceParticipantIds(selectedOccurrence).map((participantId) => childrenById.get(participantId)?.name ?? participantId)}
        transportationPlan={selectedTransportationPlan}
        reminder={selectedReminder}
        canEditEvent={selectedEvent !== null && isSelectedCustomOneTimeEvent && canEditEvent(effectiveAuthorization, selectedEvent)}
        canEditOccurrence={selectedEvent !== null && !isSelectedCustomOneTimeEvent && canEditEvent(effectiveAuthorization, selectedEvent)}
        canEditSeries={selectedEvent !== null && isSelectedCustomRecurringEvent && canEditEvent(effectiveAuthorization, selectedEvent)}
        canDeleteEvent={selectedEvent !== null && isSelectedCustomOneTimeEvent && canEditEvent(effectiveAuthorization, selectedEvent)}
        canCancelOccurrence={selectedEvent?.recurrence !== null && selectedEvent !== null && canEditEvent(effectiveAuthorization, selectedEvent)}
        canDeleteSeries={selectedEvent !== null && isSelectedCustomRecurringEvent && canEditEvent(effectiveAuthorization, selectedEvent)}
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

function buildActiveFilterSummary({
  filters,
  authorizedMemberIds,
  authorizedCategories,
  childrenById,
  language,
}: {
  filters: DashboardFilterState;
  authorizedMemberIds: string[];
  authorizedCategories: EventCategory[];
  childrenById: Map<string, Child>;
  language: Language;
}): string {
  const selectedMembers = filters.selectedMemberIds.length === authorizedMemberIds.length
    ? [language === 'en' ? 'All' : 'כולם']
    : filters.selectedMemberIds.map((memberId) => childrenById.get(memberId)?.name ?? memberId);
  const selectedCategories = filters.selectedCategories.length === authorizedCategories.length
    ? []
    : filters.selectedCategories.map((category) => getEventCategoryLabel({ category, customCategoryLabel: null }, language));
  const selectedWhen = filters.specificDate !== null
    ? [filters.specificDate]
    : filters.selectedWeekdays.map((weekday) => weekDayLabelsForSummary(language)[weekday] ?? weekday.toString());

  return [...selectedMembers, ...selectedCategories, ...selectedWhen].join(' · ');
}

function weekDayLabelsForSummary(language: Language): readonly string[] {
  return language === 'en'
    ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    : ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
}

function getCurrentTimeString(): string {
  const now = new Date();

  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}
