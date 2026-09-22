import type {
  Child,
  Event,
  EventCategory,
  EventException,
  EventReminder,
  RecurrenceRule,
  TransportationLeg,
  TransportationPlan,
} from '../../src/models';
import { events as seedEvents } from '../../src/data/events';
import {
  getDuplicateKeyForTarget,
  getDuplicateKeyFromEvent,
  importRowToEvent,
  isImportedFromSource,
  maxScheduleImportRows,
  type ScheduleImportInputRow,
  type ScheduleImportMode,
} from '../../src/services/scheduleImport';
import {
  canAccessEvent,
  hasPermission,
  isEventInScheduleScope,
  readAuthorizationContext,
} from './permissions';
import type { AuthenticatedSession } from './authCore';

type D1Value = string | number | null;

type D1PreparedStatement = {
  bind: (...values: D1Value[]) => D1PreparedStatement;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
  batch: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

type PagesContext = {
  request: Request;
  env: {
    FAMILY_DB?: D1Database;
  };
};

type StoredRow = {
  payload: string;
};

export type SharedFamilyState = {
  customChildren: Child[];
  customEvents: Event[];
  eventExceptions: EventException[];
  transportationPlans: TransportationPlan[];
  eventReminders: EventReminder[];
  authorization?: Awaited<ReturnType<typeof readAuthorizationContext>>;
  initialized: boolean;
};

type MutationRequest =
  | { action: 'upsertChild'; payload: Child }
  | { action: 'deleteChild'; payload: { id: string } }
  | { action: 'upsertEvent'; payload: Event }
  | { action: 'deleteEvent'; payload: { id: string } }
  | { action: 'upsertEventException'; payload: EventException }
  | { action: 'deleteEventException'; payload: { eventId: string; date: string } }
  | { action: 'upsertTransportationPlan'; payload: TransportationPlan }
  | { action: 'deleteTransportationPlan'; payload: { eventId: string; occurrenceDate: string } }
  | { action: 'upsertEventReminder'; payload: EventReminder }
  | { action: 'deleteEventReminder'; payload: { eventId: string; occurrenceDate: string } }
  | { action: 'importLocalData'; payload: Omit<SharedFamilyState, 'initialized'> }
  | { action: 'importSchedule'; payload: ScheduleImportPayload };

interface ScheduleImportPayload {
  targetMemberId: string;
  defaultCategory: EventCategory;
  mode: ScheduleImportMode;
  startDate?: string;
  endDate?: string | null;
  batchId: string;
  rows: ScheduleImportInputRow[];
  replaceWeekly?: boolean;
}

interface ScheduleImportResult {
  created: number;
  skipped: number;
  duplicates: number;
  errors: number;
  batchId: string;
  eventIds: string[];
}

const initializedMetaKey = 'shared_data_initialized';
const maxRequestBytes = 200_000;
const allowedReminderMinutes = [15, 30, 60, 120, 1440] as const;

const eventCategories: EventCategory[] = [
  'school',
  'basketball',
  'dance',
  'privateLesson',
  'scouts',
  'doctor',
  'dentist',
  'haircut',
  'friends',
  'family',
  'work',
  'romanticDate',
  'meal',
  'birthday',
  'exam',
  'transportation',
  'parentMeeting',
  'performance',
  'openPractice',
  'other',
];

export async function handleGetSharedState(context: PagesContext, auth?: AuthenticatedSession): Promise<Response> {
  const db = getDatabase(context);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  try {
    const [children, events, exceptions, transportationPlans, eventReminders, initialized, authorization] = await Promise.all([
      readPayloadRows<Child>(db, 'SELECT payload FROM custom_children ORDER BY id', isChild),
      readPayloadRows<Event>(db, 'SELECT payload FROM custom_events ORDER BY id', isEvent),
      readPayloadRows<EventException>(db, 'SELECT payload FROM event_exceptions ORDER BY event_id, occurrence_date', isEventException),
      readPayloadRows<TransportationPlan>(db, 'SELECT payload FROM transportation_plans ORDER BY occurrence_date, event_id', isTransportationPlan),
      readEventReminderRows(db),
      readInitializedFlag(db),
      auth === undefined ? Promise.resolve(null) : readAuthorizationContext(db, auth),
    ]);
    const visibleState = authorization === null
      ? { children, events, exceptions, transportationPlans, eventReminders }
      : filterSharedStateForAuthorization({ children, events, exceptions, transportationPlans, eventReminders }, authorization);

    return jsonResponse({
      customChildren: visibleState.children,
      customEvents: visibleState.events,
      eventExceptions: visibleState.exceptions,
      transportationPlans: visibleState.transportationPlans,
      eventReminders: visibleState.eventReminders,
      authorization: authorization ?? undefined,
      initialized,
    });
  } catch {
    return jsonResponse({ error: 'Could not load shared family data.' }, 500);
  }
}

export async function handleMutateSharedState(context: PagesContext, auth?: AuthenticatedSession): Promise<Response> {
  const db = getDatabase(context);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  const contentLength = context.request.headers.get('content-length');

  if (contentLength !== null && Number(contentLength) > maxRequestBytes) {
    return jsonResponse({ error: 'Request is too large.' }, 413);
  }

  let body: unknown;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request.' }, 400);
  }

  const mutation = parseMutationRequest(body);

  if (mutation === null) {
    return jsonResponse({ error: 'Invalid shared data request.' }, 400);
  }

  try {
    if (auth !== undefined && !(await canApplyMutation(db, auth, mutation))) {
      return jsonResponse({ error: 'Not authorized.' }, 403);
    }

    if (mutation.action === 'importSchedule') {
      return jsonResponse(await applyScheduleImport(db, auth, mutation.payload));
    }

    await applyMutation(db, mutation);

    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Could not save shared family data.' }, 500);
  }
}

export function filterSharedStateForAuthorization(
  state: {
    children: Child[];
    events: Event[];
    exceptions: EventException[];
    transportationPlans: TransportationPlan[];
    eventReminders: EventReminder[];
  },
  authorization: NonNullable<SharedFamilyState['authorization']>,
) {
  if (authorization.fullAccess) {
    return state;
  }

  if (!hasPermission(authorization, 'view_schedule')) {
    return { children: [], events: [], exceptions: [], transportationPlans: [], eventReminders: [] };
  }

  const visibleCustomEvents = state.events.filter((event) => isEventInScheduleScope(authorization, event));
  const visibleEventIds = new Set([
    ...seedEvents.filter((event) => isEventInScheduleScope(authorization, event)).map((event) => event.id),
    ...visibleCustomEvents.map((event) => event.id),
  ]);
  const visibleMemberIds = new Set([
    ...visibleCustomEvents.map((event) => event.childId),
    ...authorization.scheduleScope.memberIds,
  ]);

  return {
    children: state.children.filter((child) => authorization.scheduleScope.allMembers || visibleMemberIds.has(child.id)),
    events: visibleCustomEvents,
    exceptions: state.exceptions.filter((exception) => visibleEventIds.has(exception.eventId)),
    transportationPlans: hasPermission(authorization, 'view_transportation')
      ? state.transportationPlans.filter((plan) => visibleEventIds.has(plan.eventId))
      : [],
    eventReminders: hasPermission(authorization, 'receive_notifications')
      ? state.eventReminders.filter((reminder) => visibleEventIds.has(reminder.eventId))
      : [],
  };
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
    initialized: state.initialized,
  };
}

export function isChild(value: unknown): value is Child {
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

export function isEvent(value: unknown): value is Event {
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
    isEventCategory(event.category) &&
    (typeof event.customCategoryLabel === 'string' || event.customCategoryLabel === null) &&
    hasValidScheduleShape(event) &&
    typeof event.startTime === 'string' &&
    (typeof event.endTime === 'string' || event.endTime === null) &&
    typeof event.endsNextDay === 'boolean' &&
    (typeof event.location === 'string' || event.location === null) &&
    (typeof event.notes === 'string' || event.notes === null) &&
    typeof event.requiresTransportation === 'boolean' &&
    (typeof event.pickupTime === 'string' || event.pickupTime === null) &&
    (typeof event.dropoffTime === 'string' || event.dropoffTime === null) &&
    isEventStatus(event.status) &&
    typeof event.createdAt === 'string' &&
    typeof event.updatedAt === 'string'
  );
}

export function isEventException(value: unknown): value is EventException {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const exception = value as Partial<EventException>;

  return (
    typeof exception.id === 'string' &&
    exception.id.trim() !== '' &&
    typeof exception.eventId === 'string' &&
    exception.eventId.trim() !== '' &&
    typeof exception.date === 'string' &&
    exception.date.trim() !== '' &&
    (exception.type === 'cancelled' || exception.type === 'modified') &&
    (typeof exception.title === 'string' || exception.title === undefined) &&
    (typeof exception.startTime === 'string' || exception.startTime === undefined) &&
    (typeof exception.endTime === 'string' || exception.endTime === null || exception.endTime === undefined) &&
    (typeof exception.endsNextDay === 'boolean' || exception.endsNextDay === undefined) &&
    (typeof exception.location === 'string' || exception.location === null || exception.location === undefined) &&
    (typeof exception.notes === 'string' || exception.notes === null || exception.notes === undefined)
  );
}

export function isTransportationPlan(value: unknown): value is TransportationPlan {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const plan = value as Partial<TransportationPlan>;

  return (
    typeof plan.id === 'string' &&
    plan.id.trim() !== '' &&
    typeof plan.eventId === 'string' &&
    plan.eventId.trim() !== '' &&
    typeof plan.occurrenceDate === 'string' &&
    plan.occurrenceDate.trim() !== '' &&
    (plan.outbound === null || isTransportationLeg(plan.outbound)) &&
    (plan.returnTrip === null || isTransportationLeg(plan.returnTrip)) &&
    (plan.outbound !== null || plan.returnTrip !== null) &&
    typeof plan.createdAt === 'string' &&
    typeof plan.updatedAt === 'string'
  );
}

export function isEventReminder(value: unknown): value is EventReminder {
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

export function mergeUniqueById<T extends { id: string }>(baseItems: T[], sharedItems: T[]): T[] {
  const itemsById = new Map(baseItems.map((item) => [item.id, item]));

  for (const item of sharedItems) {
    itemsById.set(item.id, item);
  }

  return Array.from(itemsById.values());
}

export function upsertByEventDate<T extends { eventId: string; date: string }>(items: T[], nextItem: T): T[] {
  const existingIndex = items.findIndex((item) => item.eventId === nextItem.eventId && item.date === nextItem.date);

  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item));
}

export function upsertTransportationByEventDate(items: TransportationPlan[], nextItem: TransportationPlan): TransportationPlan[] {
  const existingIndex = items.findIndex(
    (item) => item.eventId === nextItem.eventId && item.occurrenceDate === nextItem.occurrenceDate,
  );

  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item));
}

export function upsertReminderByEventDate(items: EventReminder[], nextItem: EventReminder): EventReminder[] {
  const existingIndex = items.findIndex(
    (item) => item.eventId === nextItem.eventId && item.occurrenceDate === nextItem.occurrenceDate,
  );

  if (existingIndex === -1) {
    return [...items, nextItem];
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item));
}

function parseMutationRequest(value: unknown): MutationRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const request = value as { action?: unknown; payload?: unknown };

  switch (request.action) {
    case 'upsertChild':
      return isChild(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'deleteChild':
      return isIdPayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'upsertEvent':
      return isEvent(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'deleteEvent':
      return isIdPayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'upsertEventException':
      return isEventException(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'deleteEventException':
      return isEventDatePayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'upsertTransportationPlan':
      return isTransportationPlan(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'deleteTransportationPlan':
      return isTransportationDatePayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'upsertEventReminder':
      return isEventReminder(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'deleteEventReminder':
      return isTransportationDatePayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'importLocalData':
      return isImportPayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    case 'importSchedule':
      return isScheduleImportPayload(request.payload) ? { action: request.action, payload: request.payload } : null;
    default:
      return null;
  }
}

async function canApplyMutation(db: D1Database, auth: AuthenticatedSession, mutation: MutationRequest): Promise<boolean> {
  const authorization = await readAuthorizationContext(db, auth);

  if (authorization.fullAccess) {
    return true;
  }

  switch (mutation.action) {
    case 'upsertChild':
    case 'deleteChild':
    case 'importLocalData':
      return false;
    case 'importSchedule':
      return hasPermission(authorization, 'edit_schedule');
    case 'upsertEvent':
      return canAccessEvent(authorization, mutation.payload, 'edit_schedule');
    case 'deleteEvent': {
      const event = await readKnownEventById(db, mutation.payload.id);

      return event !== null && canAccessEvent(authorization, event, 'edit_schedule');
    }
    case 'upsertEventException':
    case 'deleteEventException': {
      const event = await readKnownEventById(db, mutation.payload.eventId);

      return event !== null && canAccessEvent(authorization, event, 'edit_schedule');
    }
    case 'upsertTransportationPlan':
    case 'deleteTransportationPlan': {
      const event = await readKnownEventById(db, mutation.payload.eventId);

      return event !== null && canAccessEvent(authorization, event, 'edit_transportation');
    }
    case 'upsertEventReminder':
    case 'deleteEventReminder': {
      const event = await readKnownEventById(db, mutation.payload.eventId);

      return event !== null && canAccessEvent(authorization, event, 'receive_notifications');
    }
  }
}

async function applyScheduleImport(db: D1Database, auth: AuthenticatedSession | undefined, payload: ScheduleImportPayload): Promise<ScheduleImportResult> {
  const authorization = auth === undefined ? null : await readAuthorizationContext(db, auth);
  const nowIso = new Date().toISOString();
  const customEvents = await readPayloadRows<Event>(db, 'SELECT payload FROM custom_events ORDER BY id', isEvent);
  const duplicateKeys = new Set([...seedEvents, ...customEvents].map((event) => getDuplicateKeyFromEvent(event)));
  const statements: D1PreparedStatement[] = [];
  const eventIds: string[] = [];
  let skipped = 0;
  let duplicates = 0;
  let errors = 0;

  if (payload.replaceWeekly === true && payload.defaultCategory === 'basketball' && payload.startDate !== undefined) {
    const weekEndDate = payload.endDate ?? payload.startDate;
    const removableEvents = customEvents.filter((event) =>
      event.childId === payload.targetMemberId &&
      event.category === 'basketball' &&
      event.recurrence === null &&
      event.date !== null &&
      event.date >= payload.startDate! &&
      event.date <= weekEndDate &&
      isImportedFromSource(event, 'whatsapp_weekly') &&
      (authorization === null || canAccessEvent(authorization, event, 'edit_schedule'))
    );

    statements.push(...removableEvents.map((event) => db.prepare('DELETE FROM custom_events WHERE id = ?').bind(event.id)));
    for (const event of removableEvents) {
      duplicateKeys.delete(getDuplicateKeyFromEvent(event));
    }
  }

  for (const row of payload.rows) {
    if (!row.selected) {
      skipped += 1;
      continue;
    }

    const event = importRowToEvent({
      row,
      targetMemberId: payload.targetMemberId,
      defaultCategory: payload.defaultCategory,
      mode: payload.mode,
      startDate: payload.startDate,
      endDate: payload.endDate,
      batchId: payload.batchId,
      nowIso,
    });

    if (event === null || !isEvent(event)) {
      errors += 1;
      continue;
    }

    if (authorization !== null && !canAccessEvent(authorization, event, 'edit_schedule')) {
      errors += 1;
      continue;
    }

    const duplicateKey = getDuplicateKeyForTarget(row, payload.targetMemberId, payload.defaultCategory);

    if (duplicateKey !== null && duplicateKeys.has(duplicateKey)) {
      duplicates += 1;
      continue;
    }

    duplicateKeys.add(getDuplicateKeyFromEvent(event));
    eventIds.push(event.id);
    statements.push(
      db
        .prepare('INSERT INTO custom_events (id, child_id, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET child_id = excluded.child_id, payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(event.id, event.childId, JSON.stringify(event), event.updatedAt),
    );
  }

  if (statements.length > 0) {
    await db.batch(statements);
    await markInitialized(db);
  }

  return {
    created: eventIds.length,
    skipped,
    duplicates,
    errors,
    batchId: payload.batchId,
    eventIds,
  };
}

async function readKnownEventById(db: D1Database, eventId: string): Promise<Event | null> {
  const seedEvent = seedEvents.find((event) => event.id === eventId);

  if (seedEvent !== undefined) {
    return seedEvent;
  }

  const row = await db.prepare('SELECT payload FROM custom_events WHERE id = ?').bind(eventId).first<StoredRow>();

  if (row === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(row.payload);

    return isEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function applyMutation(db: D1Database, mutation: MutationRequest): Promise<void> {
  switch (mutation.action) {
    case 'upsertChild':
      await db
        .prepare('INSERT INTO custom_children (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(mutation.payload.id, JSON.stringify(mutation.payload), new Date().toISOString())
        .run();
      break;
    case 'deleteChild':
      await db.prepare('DELETE FROM custom_children WHERE id = ?').bind(mutation.payload.id).run();
      break;
    case 'upsertEvent':
      await db
        .prepare('INSERT INTO custom_events (id, child_id, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET child_id = excluded.child_id, payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(mutation.payload.id, mutation.payload.childId, JSON.stringify(mutation.payload), mutation.payload.updatedAt)
        .run();
      break;
    case 'deleteEvent':
      await db.batch([
        db.prepare('DELETE FROM custom_events WHERE id = ?').bind(mutation.payload.id),
        db.prepare('DELETE FROM event_exceptions WHERE event_id = ?').bind(mutation.payload.id),
        db.prepare('DELETE FROM transportation_plans WHERE event_id = ?').bind(mutation.payload.id),
        db.prepare('DELETE FROM event_reminders WHERE event_id = ?').bind(mutation.payload.id),
      ]);
      break;
    case 'upsertEventException':
      await db
        .prepare('INSERT INTO event_exceptions (event_id, occurrence_date, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, occurrence_date) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(mutation.payload.eventId, mutation.payload.date, JSON.stringify(mutation.payload), new Date().toISOString())
        .run();
      break;
    case 'deleteEventException':
      await db
        .prepare('DELETE FROM event_exceptions WHERE event_id = ? AND occurrence_date = ?')
        .bind(mutation.payload.eventId, mutation.payload.date)
        .run();
      break;
    case 'upsertTransportationPlan':
      await db
        .prepare('INSERT INTO transportation_plans (id, event_id, occurrence_date, payload, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id, occurrence_date) DO UPDATE SET id = excluded.id, payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(
          mutation.payload.id,
          mutation.payload.eventId,
          mutation.payload.occurrenceDate,
          JSON.stringify(mutation.payload),
          mutation.payload.updatedAt,
        )
        .run();
      break;
    case 'deleteTransportationPlan':
      await db
        .prepare('DELETE FROM transportation_plans WHERE event_id = ? AND occurrence_date = ?')
        .bind(mutation.payload.eventId, mutation.payload.occurrenceDate)
        .run();
      break;
    case 'upsertEventReminder':
      await db
        .prepare('INSERT INTO event_reminders (id, event_id, occurrence_date, minutes_before, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id, occurrence_date) DO UPDATE SET id = excluded.id, minutes_before = excluded.minutes_before, enabled = excluded.enabled, updated_at = excluded.updated_at')
        .bind(
          mutation.payload.id,
          mutation.payload.eventId,
          mutation.payload.occurrenceDate,
          mutation.payload.reminderMinutesBefore,
          mutation.payload.enabled ? 1 : 0,
          mutation.payload.createdAt,
          mutation.payload.updatedAt,
        )
        .run();
      break;
    case 'deleteEventReminder':
      await db
        .prepare('DELETE FROM event_reminders WHERE event_id = ? AND occurrence_date = ?')
        .bind(mutation.payload.eventId, mutation.payload.occurrenceDate)
        .run();
      break;
    case 'importLocalData':
      await importLocalData(db, mutation.payload);
      break;
  }

  await markInitialized(db);
}

async function importLocalData(db: D1Database, payload: Omit<SharedFamilyState, 'initialized'>): Promise<void> {
  const statements = [
    ...payload.customChildren.map((child) =>
      db
        .prepare('INSERT INTO custom_children (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(child.id, JSON.stringify(child), new Date().toISOString()),
    ),
    ...payload.customEvents.map((event) =>
      db
        .prepare('INSERT INTO custom_events (id, child_id, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET child_id = excluded.child_id, payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(event.id, event.childId, JSON.stringify(event), event.updatedAt),
    ),
    ...payload.eventExceptions.map((exception) =>
      db
        .prepare('INSERT INTO event_exceptions (event_id, occurrence_date, payload, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, occurrence_date) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(exception.eventId, exception.date, JSON.stringify(exception), new Date().toISOString()),
    ),
    ...payload.transportationPlans.map((plan) =>
      db
        .prepare('INSERT INTO transportation_plans (id, event_id, occurrence_date, payload, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(event_id, occurrence_date) DO UPDATE SET id = excluded.id, payload = excluded.payload, updated_at = excluded.updated_at')
        .bind(plan.id, plan.eventId, plan.occurrenceDate, JSON.stringify(plan), plan.updatedAt),
    ),
    ...(payload.eventReminders ?? []).map((reminder) =>
      db
        .prepare('INSERT INTO event_reminders (id, event_id, occurrence_date, minutes_before, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(event_id, occurrence_date) DO UPDATE SET id = excluded.id, minutes_before = excluded.minutes_before, enabled = excluded.enabled, updated_at = excluded.updated_at')
        .bind(
          reminder.id,
          reminder.eventId,
          reminder.occurrenceDate,
          reminder.reminderMinutesBefore,
          reminder.enabled ? 1 : 0,
          reminder.createdAt,
          reminder.updatedAt,
        ),
    ),
  ];

  if (statements.length > 0) {
    await db.batch(statements);
  }
}

async function readPayloadRows<T>(db: D1Database, query: string, isValid: (value: unknown) => value is T): Promise<T[]> {
  const { results = [] } = await db.prepare(query).all<StoredRow>();

  return results.flatMap((row) => {
    try {
      const parsedPayload: unknown = JSON.parse(row.payload);

      return isValid(parsedPayload) ? [parsedPayload] : [];
    } catch {
      return [];
    }
  });
}

async function readEventReminderRows(db: D1Database): Promise<EventReminder[]> {
  try {
    const { results = [] } = await db
      .prepare(
        'SELECT id, event_id, occurrence_date, minutes_before, enabled, created_at, updated_at FROM event_reminders ORDER BY occurrence_date, event_id',
      )
      .all<{
        id: string;
        event_id: string;
        occurrence_date: string;
        minutes_before: number;
        enabled: number;
        created_at: string;
        updated_at: string;
      }>();

    return results
      .map((row) => ({
        id: row.id,
        eventId: row.event_id,
        occurrenceDate: row.occurrence_date,
        reminderMinutesBefore: row.minutes_before,
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))
      .filter(isEventReminder);
  } catch {
    return [];
  }
}

async function readInitializedFlag(db: D1Database): Promise<boolean> {
  const row = await db.prepare('SELECT value FROM app_meta WHERE key = ?').bind(initializedMetaKey).first<{ value: string }>();

  return row?.value === 'true';
}

async function markInitialized(db: D1Database): Promise<void> {
  await db
    .prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(initializedMetaKey, 'true')
    .run();
}

function getDatabase(context: PagesContext): D1Database | null {
  return context.env.FAMILY_DB ?? null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isImportPayload(value: unknown): value is Omit<SharedFamilyState, 'initialized'> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<Omit<SharedFamilyState, 'initialized'>>;

  return (
    Array.isArray(payload.customChildren) &&
    Array.isArray(payload.customEvents) &&
    Array.isArray(payload.eventExceptions) &&
    Array.isArray(payload.transportationPlans) &&
    (payload.eventReminders === undefined || Array.isArray(payload.eventReminders)) &&
    payload.customChildren.every(isChild) &&
    payload.customEvents.every(isEvent) &&
    payload.eventExceptions.every(isEventException) &&
    payload.transportationPlans.every(isTransportationPlan) &&
    (payload.eventReminders === undefined || payload.eventReminders.every(isEventReminder))
  );
}

function isScheduleImportPayload(value: unknown): value is ScheduleImportPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<ScheduleImportPayload>;

  return (
    typeof payload.targetMemberId === 'string' &&
    payload.targetMemberId.trim() !== '' &&
    isEventCategory(payload.defaultCategory) &&
    (payload.mode === 'dated' || payload.mode === 'weekly') &&
    (typeof payload.startDate === 'string' || payload.startDate === undefined) &&
    (typeof payload.endDate === 'string' || payload.endDate === null || payload.endDate === undefined) &&
    typeof payload.batchId === 'string' &&
    payload.batchId.trim() !== '' &&
    (typeof payload.replaceWeekly === 'boolean' || payload.replaceWeekly === undefined) &&
    Array.isArray(payload.rows) &&
    payload.rows.length <= maxScheduleImportRows &&
    payload.rows.every(isScheduleImportInputRow)
  );
}

function isScheduleImportInputRow(value: unknown): value is ScheduleImportInputRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Partial<ScheduleImportInputRow>;

  return (
    typeof row.sourceRow === 'number' &&
    Number.isInteger(row.sourceRow) &&
    (typeof row.date === 'string' || row.date === null) &&
    (typeof row.weekday === 'number' || row.weekday === null) &&
    typeof row.startTime === 'string' &&
    (typeof row.endTime === 'string' || row.endTime === null) &&
    typeof row.title === 'string' &&
    (typeof row.location === 'string' || row.location === null) &&
    (typeof row.notes === 'string' || row.notes === null) &&
    (isEventCategory(row.category) || row.category === null) &&
    typeof row.selected === 'boolean' &&
    (row.status === 'ready' || row.status === 'duplicate' || row.status === 'warning' || row.status === 'invalid') &&
    Array.isArray(row.messages) &&
    row.messages.every((message) => typeof message === 'string')
  );
}

function isIdPayload(value: unknown): value is { id: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as { id?: unknown };

  return typeof payload.id === 'string' && payload.id.trim() !== '';
}

function isEventDatePayload(value: unknown): value is { eventId: string; date: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as { eventId?: unknown; date?: unknown };

  return typeof payload.eventId === 'string' && payload.eventId.trim() !== '' && typeof payload.date === 'string' && payload.date.trim() !== '';
}

function isTransportationDatePayload(value: unknown): value is { eventId: string; occurrenceDate: string } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as { eventId?: unknown; occurrenceDate?: unknown };

  return (
    typeof payload.eventId === 'string' &&
    payload.eventId.trim() !== '' &&
    typeof payload.occurrenceDate === 'string' &&
    payload.occurrenceDate.trim() !== ''
  );
}

function hasValidScheduleShape(event: Partial<Event>): boolean {
  const hasOneTimeDate = typeof event.date === 'string' && event.date.trim() !== '' && event.recurrence === null;
  const hasRecurrence = event.date === null && isRecurrenceRule(event.recurrence);

  return hasOneTimeDate || hasRecurrence;
}

function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const recurrence = value as Partial<RecurrenceRule>;

  return (
    (recurrence.frequency === 'daily' || recurrence.frequency === 'weekly' || recurrence.frequency === 'monthly') &&
    typeof recurrence.interval === 'number' &&
    Number.isInteger(recurrence.interval) &&
    recurrence.interval > 0 &&
    typeof recurrence.startDate === 'string' &&
    recurrence.startDate.trim() !== '' &&
    (typeof recurrence.endDate === 'string' || recurrence.endDate === null || recurrence.endDate === undefined) &&
    (recurrence.daysOfWeek === undefined ||
      (Array.isArray(recurrence.daysOfWeek) &&
        recurrence.daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)))
  );
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string' && eventCategories.includes(value as EventCategory);
}

function isEventStatus(value: unknown): value is Event['status'] {
  return value === 'scheduled' || value === 'confirmed' || value === 'changed' || value === 'cancelled' || value === 'completed';
}

function isTransportationLeg(value: unknown): value is TransportationLeg {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const leg = value as Partial<TransportationLeg>;

  return (
    leg.enabled === true &&
    typeof leg.driverName === 'string' &&
    leg.driverName.trim() !== '' &&
    typeof leg.time === 'string' &&
    typeof leg.occursNextDay === 'boolean' &&
    (typeof leg.from === 'string' || leg.from === null) &&
    (typeof leg.to === 'string' || leg.to === null) &&
    Array.isArray(leg.passengerChildIds) &&
    leg.passengerChildIds.every((childId) => typeof childId === 'string' && childId.trim() !== '') &&
    (typeof leg.additionalPassengers === 'string' || leg.additionalPassengers === null) &&
    (typeof leg.notes === 'string' || leg.notes === null)
  );
}

function isAllowedReminderMinutes(value: number): value is EventReminder['reminderMinutesBefore'] {
  return allowedReminderMinutes.includes(value as EventReminder['reminderMinutesBefore']);
}
