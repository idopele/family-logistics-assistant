import type { AuthorizationContext, Child, Event, EventException, EventReminder, TransportationLeg, TransportationPlan } from '../models';
import type { ScheduleImportInputRow, ScheduleImportMode } from './scheduleImport';
import { isAuthorizationContext } from './authorization';
import { loadCustomChildren } from './localChildStorage';
import { loadCustomEventExceptions } from './localEventExceptionStorage';
import { loadCustomEvents } from './localEventStorage';
import { loadTransportationPlans } from './localTransportationStorage';

export type SharedFamilyState = {
  customChildren: Child[];
  customEvents: Event[];
  eventExceptions: EventException[];
  transportationPlans: TransportationPlan[];
  eventReminders: EventReminder[];
  authorization?: AuthorizationContext;
  initialized: boolean;
};

export type LocalFamilyData = Omit<SharedFamilyState, 'initialized'>;

export interface ScheduleImportResult {
  created: number;
  skipped: number;
  duplicates: number;
  errors: number;
  batchId: string;
  eventIds: string[];
}

type Fetcher = typeof fetch;

const sharedApiPath = '/api/shared';

export async function loadSharedFamilyState(fetcher: Fetcher = fetch): Promise<SharedFamilyState> {
  const response = await fetcher(sharedApiPath, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Could not load shared family data.');
  }

  const payload: unknown = await response.json();
  const parsedState = parseSharedFamilyState(payload);

  if (parsedState === null) {
    throw new Error('Shared family data response was invalid.');
  }

  return parsedState;
}

export function loadLocalFamilyDataForMigration(): LocalFamilyData {
  return {
    customChildren: loadCustomChildren(),
    customEvents: loadCustomEvents(),
    eventExceptions: loadCustomEventExceptions(),
    transportationPlans: loadTransportationPlans(),
    eventReminders: [],
  };
}

export function hasLocalFamilyData(data: LocalFamilyData): boolean {
  return (
    data.customChildren.length > 0 ||
    data.customEvents.length > 0 ||
    data.eventExceptions.length > 0 ||
    data.transportationPlans.length > 0 ||
    data.eventReminders.length > 0
  );
}

export function mergeSharedChildren(seedChildren: Child[], sharedChildren: Child[]): Child[] {
  return mergeUniqueById(seedChildren, sharedChildren);
}

export function mergeSharedEvents(seedEvents: Event[], sharedEvents: Event[]): Event[] {
  return mergeUniqueById(seedEvents, sharedEvents);
}

export async function upsertSharedChild(child: Child, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'upsertChild', payload: child }, fetcher);
}

export async function deleteSharedChild(id: string, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'deleteChild', payload: { id } }, fetcher);
}

export async function upsertSharedEvent(event: Event, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'upsertEvent', payload: event }, fetcher);
}

export async function deleteSharedEvent(id: string, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'deleteEvent', payload: { id } }, fetcher);
}

export async function upsertSharedEventException(exception: EventException, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'upsertEventException', payload: exception }, fetcher);
}

export async function deleteSharedEventException(eventId: string, date: string, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'deleteEventException', payload: { eventId, date } }, fetcher);
}

export async function upsertSharedTransportationPlan(plan: TransportationPlan, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'upsertTransportationPlan', payload: plan }, fetcher);
}

export async function deleteSharedTransportationPlan(eventId: string, occurrenceDate: string, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'deleteTransportationPlan', payload: { eventId, occurrenceDate } }, fetcher);
}

export async function upsertSharedEventReminder(reminder: EventReminder, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'upsertEventReminder', payload: reminder }, fetcher);
}

export async function deleteSharedEventReminder(eventId: string, occurrenceDate: string, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'deleteEventReminder', payload: { eventId, occurrenceDate } }, fetcher);
}

export async function importLocalFamilyData(data: LocalFamilyData, fetcher: Fetcher = fetch): Promise<void> {
  await sendMutation({ action: 'importLocalData', payload: data }, fetcher);
}

export async function importSharedSchedule(
  payload: {
    targetMemberId: string;
    defaultCategory: Event['category'];
    mode: ScheduleImportMode;
    startDate?: string;
    endDate?: string | null;
    batchId: string;
    rows: ScheduleImportInputRow[];
  },
  fetcher: Fetcher = fetch,
): Promise<ScheduleImportResult> {
  const response = await sendMutation({ action: 'importSchedule', payload }, fetcher);
  const result = await response.json() as unknown;

  if (!isScheduleImportResult(result)) {
    throw new Error('Import response was invalid.');
  }

  return result;
}

export function upsertSharedEventExceptionInState(exceptions: EventException[], nextException: EventException): EventException[] {
  return upsertByEventDate(exceptions, nextException);
}

export function upsertSharedTransportationPlanInState(
  plans: TransportationPlan[],
  nextPlan: TransportationPlan,
): TransportationPlan[] {
  const existingIndex = plans.findIndex(
    (plan) => plan.eventId === nextPlan.eventId && plan.occurrenceDate === nextPlan.occurrenceDate,
  );

  if (existingIndex === -1) {
    return [...plans, nextPlan];
  }

  return plans.map((plan, index) => (index === existingIndex ? nextPlan : plan));
}

export function upsertSharedEventReminderInState(reminders: EventReminder[], nextReminder: EventReminder): EventReminder[] {
  const existingIndex = reminders.findIndex(
    (reminder) => reminder.eventId === nextReminder.eventId && reminder.occurrenceDate === nextReminder.occurrenceDate,
  );

  if (existingIndex === -1) {
    return [...reminders, nextReminder];
  }

  return reminders.map((reminder, index) => (index === existingIndex ? nextReminder : reminder));
}

export function deleteSharedEventReminderInState(
  reminders: EventReminder[],
  eventId: string,
  occurrenceDate: string,
): EventReminder[] {
  return reminders.filter((reminder) => reminder.eventId !== eventId || reminder.occurrenceDate !== occurrenceDate);
}

export function isLocalMigrationConfirmed(localData: LocalFamilyData, sharedState: SharedFamilyState): boolean {
  return (
    localData.customChildren.every((child) => sharedState.customChildren.some((sharedChild) => sharedChild.id === child.id)) &&
    localData.customEvents.every((event) => sharedState.customEvents.some((sharedEvent) => sharedEvent.id === event.id)) &&
    localData.eventExceptions.every((exception) =>
      sharedState.eventExceptions.some(
        (sharedException) => sharedException.eventId === exception.eventId && sharedException.date === exception.date,
      ),
    ) &&
    localData.transportationPlans.every((plan) =>
      sharedState.transportationPlans.some(
        (sharedPlan) => sharedPlan.eventId === plan.eventId && sharedPlan.occurrenceDate === plan.occurrenceDate,
      ),
    ) &&
    (localData.eventReminders ?? []).every((reminder) =>
      (sharedState.eventReminders ?? []).some(
        (sharedReminder) => sharedReminder.eventId === reminder.eventId && sharedReminder.occurrenceDate === reminder.occurrenceDate,
      ),
    )
  );
}

export function parseSharedFamilyState(value: unknown): SharedFamilyState | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const state = value as Partial<SharedFamilyState>;

  if (
    !Array.isArray(state.customChildren) ||
    !Array.isArray(state.customEvents) ||
    !Array.isArray(state.eventExceptions) ||
    !Array.isArray(state.transportationPlans) ||
    (state.eventReminders !== undefined && !Array.isArray(state.eventReminders)) ||
    (state.authorization !== undefined && !isAuthorizationContext(state.authorization)) ||
    typeof state.initialized !== 'boolean'
  ) {
    return null;
  }

  if (
    !state.customChildren.every(isChild) ||
    !state.customEvents.every(isEvent) ||
    !state.eventExceptions.every(isEventException) ||
    !state.transportationPlans.every(isTransportationPlan) ||
    (state.eventReminders !== undefined && !state.eventReminders.every(isEventReminder))
  ) {
    return null;
  }

  return {
    customChildren: state.customChildren,
    customEvents: state.customEvents,
    eventExceptions: state.eventExceptions,
    transportationPlans: state.transportationPlans,
    eventReminders: state.eventReminders ?? [],
    authorization: state.authorization,
    initialized: state.initialized,
  };
}

async function sendMutation(body: unknown, fetcher: Fetcher): Promise<Response> {
  const response = await fetcher(sharedApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Could not save shared family data.');
  }

  return response;
}

function isScheduleImportResult(value: unknown): value is ScheduleImportResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Partial<ScheduleImportResult>;

  return (
    typeof result.created === 'number' &&
    typeof result.skipped === 'number' &&
    typeof result.duplicates === 'number' &&
    typeof result.errors === 'number' &&
    typeof result.batchId === 'string' &&
    Array.isArray(result.eventIds) &&
    result.eventIds.every((id) => typeof id === 'string')
  );
}

function mergeUniqueById<T extends { id: string }>(baseItems: T[], sharedItems: T[]): T[] {
  const itemsById = new Map(baseItems.map((item) => [item.id, item]));

  for (const item of sharedItems) {
    itemsById.set(item.id, item);
  }

  return Array.from(itemsById.values());
}

function upsertByEventDate<T extends { eventId: string; date: string }>(items: T[], nextItem: T): T[] {
  const existingIndex = items.findIndex((item) => item.eventId === nextItem.eventId && item.date === nextItem.date);

  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item));
}

function isChild(value: unknown): value is Child {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const child = value as Partial<Child>;

  return (
    typeof child.id === 'string' &&
    child.id.trim() !== '' &&
    typeof child.name === 'string' &&
    child.name.trim() !== '' &&
    typeof child.color === 'string' &&
    child.color.trim() !== '' &&
    typeof child.isActive === 'boolean'
  );
}

function isEvent(value: unknown): value is Event {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Partial<Event>;

  return (
    typeof event.id === 'string' &&
    event.id.trim() !== '' &&
    typeof event.childId === 'string' &&
    event.childId.trim() !== '' &&
    typeof event.title === 'string' &&
    event.title.trim() !== '' &&
    typeof event.category === 'string' &&
    (typeof event.customCategoryLabel === 'string' || event.customCategoryLabel === null) &&
    ((typeof event.date === 'string' && event.recurrence === null) || (event.date === null && isRecurrenceRule(event.recurrence))) &&
    typeof event.startTime === 'string' &&
    (typeof event.endTime === 'string' || event.endTime === null) &&
    typeof event.endsNextDay === 'boolean' &&
    (typeof event.location === 'string' || event.location === null) &&
    (typeof event.notes === 'string' || event.notes === null) &&
    typeof event.requiresTransportation === 'boolean' &&
    (typeof event.pickupTime === 'string' || event.pickupTime === null) &&
    (typeof event.dropoffTime === 'string' || event.dropoffTime === null) &&
    typeof event.status === 'string' &&
    typeof event.createdAt === 'string' &&
    typeof event.updatedAt === 'string'
  );
}

function isEventException(value: unknown): value is EventException {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const exception = value as Partial<EventException>;

  return (
    typeof exception.id === 'string' &&
    typeof exception.eventId === 'string' &&
    typeof exception.date === 'string' &&
    (exception.type === 'cancelled' || exception.type === 'modified') &&
    (typeof exception.title === 'string' || exception.title === undefined) &&
    (typeof exception.startTime === 'string' || exception.startTime === undefined) &&
    (typeof exception.endTime === 'string' || exception.endTime === null || exception.endTime === undefined) &&
    (typeof exception.endsNextDay === 'boolean' || exception.endsNextDay === undefined) &&
    (typeof exception.location === 'string' || exception.location === null || exception.location === undefined) &&
    (typeof exception.notes === 'string' || exception.notes === null || exception.notes === undefined)
  );
}

function isRecurrenceRule(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const recurrence = value as {
    frequency?: unknown;
    interval?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    daysOfWeek?: unknown;
  };

  return (
    (recurrence.frequency === 'daily' || recurrence.frequency === 'weekly' || recurrence.frequency === 'monthly') &&
    typeof recurrence.interval === 'number' &&
    Number.isInteger(recurrence.interval) &&
    recurrence.interval > 0 &&
    typeof recurrence.startDate === 'string' &&
    (typeof recurrence.endDate === 'string' || recurrence.endDate === null || recurrence.endDate === undefined) &&
    (recurrence.daysOfWeek === undefined ||
      (Array.isArray(recurrence.daysOfWeek) &&
        recurrence.daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
  );
}

function isTransportationPlan(value: unknown): value is TransportationPlan {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const plan = value as Partial<TransportationPlan>;

  return (
    typeof plan.id === 'string' &&
    typeof plan.eventId === 'string' &&
    typeof plan.occurrenceDate === 'string' &&
    (plan.outbound === null || isTransportationLeg(plan.outbound)) &&
    (plan.returnTrip === null || isTransportationLeg(plan.returnTrip)) &&
    (plan.outbound !== null || plan.returnTrip !== null) &&
    typeof plan.createdAt === 'string' &&
    typeof plan.updatedAt === 'string'
  );
}

function isEventReminder(value: unknown): value is EventReminder {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const reminder = value as Partial<EventReminder>;

  return (
    typeof reminder.id === 'string' &&
    reminder.id.trim() !== '' &&
    typeof reminder.eventId === 'string' &&
    reminder.eventId.trim() !== '' &&
    typeof reminder.occurrenceDate === 'string' &&
    reminder.occurrenceDate.trim() !== '' &&
    typeof reminder.reminderMinutesBefore === 'number' &&
    isAllowedReminderMinutes(reminder.reminderMinutesBefore) &&
    typeof reminder.enabled === 'boolean' &&
    typeof reminder.createdAt === 'string' &&
    typeof reminder.updatedAt === 'string'
  );
}

function isTransportationLeg(value: unknown): value is TransportationLeg {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const leg = value as Partial<TransportationLeg>;

  return (
    leg.enabled === true &&
    typeof leg.driverName === 'string' &&
    typeof leg.time === 'string' &&
    typeof leg.occursNextDay === 'boolean' &&
    (typeof leg.from === 'string' || leg.from === null) &&
    (typeof leg.to === 'string' || leg.to === null) &&
    Array.isArray(leg.passengerChildIds) &&
    leg.passengerChildIds.every((childId) => typeof childId === 'string') &&
    (typeof leg.additionalPassengers === 'string' || leg.additionalPassengers === null) &&
    (typeof leg.notes === 'string' || leg.notes === null)
  );
}

function isAllowedReminderMinutes(value: number): value is EventReminder['reminderMinutesBefore'] {
  return value === 15 || value === 30 || value === 60 || value === 120 || value === 1440;
}
