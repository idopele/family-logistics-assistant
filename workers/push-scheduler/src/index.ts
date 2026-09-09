import type { Child, Event, EventException, EventReminder, PushSubscriptionRecord } from '../../../src/models';
import {
  maxPushDeliveryAttempts,
  resolveDueReminderJobs,
  shouldDisableSubscriptionForStatus,
  shouldRetryDelivery,
  type FamilyScheduleData,
  type ReminderNotificationJob,
} from '../../../src/services/notificationScheduling';
import { sendWebPushNotification, type WebPushConfig } from '../../../src/services/webPush';

type D1Value = string | number | null;

type D1PreparedStatement = {
  bind: (...values: D1Value[]) => D1PreparedStatement;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<{ meta?: { changes?: number } }>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

interface PushSchedulerEnv {
  FAMILY_DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  FAMILY_TIME_ZONE?: string;
  NOTIFICATION_LANGUAGE?: 'he' | 'en';
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface PayloadRow {
  payload: string;
}

interface ReminderRow {
  id: string;
  event_id: string;
  occurrence_date: string;
  minutes_before: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: number;
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
  last_success_at: string | null;
  last_failure_at: string | null;
  failure_count: number;
}

interface DeliveryRow {
  id: string;
  status: string;
  attempt_count: number;
}

export interface SchedulerRunSummary {
  dueReminders: number;
  subscriptions: number;
  sent: number;
  skipped: number;
  failed: number;
  invalidSubscriptionsDisabled: number;
}

export default {
  async scheduled(controller: ScheduledController, env: PushSchedulerEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledPushNotifications(controller, env));
  },
};

export async function runScheduledPushNotifications(
  controller: ScheduledController,
  env: PushSchedulerEnv,
): Promise<SchedulerRunSummary> {
  const nowUtc = new Date(controller.scheduledTime).toISOString();

  console.log('push scheduler started', { nowUtc, cron: controller.cron });

  const summary = await processDueNotifications({
    db: env.FAMILY_DB,
    config: {
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
      vapidPrivateKey: env.VAPID_PRIVATE_KEY,
      vapidSubject: env.VAPID_SUBJECT,
    },
    nowUtc,
    timeZone: env.FAMILY_TIME_ZONE ?? 'Asia/Jerusalem',
    language: env.NOTIFICATION_LANGUAGE ?? 'he',
  });

  console.log('push scheduler finished', summary);

  return summary;
}

export async function processDueNotifications({
  db,
  config,
  nowUtc,
  timeZone,
  language,
  sendPush = sendWebPushNotification,
}: {
  db: D1Database;
  config: WebPushConfig;
  nowUtc: string;
  timeZone: string;
  language: 'he' | 'en';
  sendPush?: typeof sendWebPushNotification;
}): Promise<SchedulerRunSummary> {
  const [data, subscriptions] = await Promise.all([readFamilyScheduleData(db), readEnabledPushSubscriptions(db)]);
  const dueJobs = resolveDueReminderJobs({ data, nowUtc, timeZone, language });
  const summary: SchedulerRunSummary = {
    dueReminders: dueJobs.length,
    subscriptions: subscriptions.length,
    sent: 0,
    skipped: 0,
    failed: 0,
    invalidSubscriptionsDisabled: 0,
  };

  for (const job of dueJobs) {
    for (const subscription of subscriptions) {
      const result = await processDelivery(db, job, subscription, config, nowUtc, sendPush);

      summary.sent += result === 'sent' ? 1 : 0;
      summary.skipped += result === 'skipped' ? 1 : 0;
      summary.failed += result === 'failed' ? 1 : 0;
      summary.invalidSubscriptionsDisabled += result === 'invalid-subscription-disabled' ? 1 : 0;
    }
  }

  return summary;
}

async function processDelivery(
  db: D1Database,
  job: ReminderNotificationJob,
  subscription: PushSubscriptionRecord,
  config: WebPushConfig,
  nowUtc: string,
  sendPush: typeof sendWebPushNotification,
): Promise<'sent' | 'skipped' | 'failed' | 'invalid-subscription-disabled'> {
  const deliveryId = buildDeliveryId(job.reminder.id, subscription.id, job.timing.scheduledForUtc);

  await db
    .prepare(
      'INSERT OR IGNORE INTO notification_deliveries (id, reminder_id, event_id, occurrence_date, subscription_id, scheduled_for_utc, status, attempt_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(
      deliveryId,
      job.reminder.id,
      job.occurrence.eventId,
      job.occurrence.date,
      subscription.id,
      job.timing.scheduledForUtc,
      'pending',
      0,
      nowUtc,
      nowUtc,
    )
    .run();

  const delivery = await db
    .prepare('SELECT id, status, attempt_count FROM notification_deliveries WHERE id = ?')
    .bind(deliveryId)
    .first<DeliveryRow>();

  if (delivery === null || delivery.status === 'sent' || delivery.attempt_count >= maxPushDeliveryAttempts) {
    return 'skipped';
  }

  await db
    .prepare('UPDATE notification_deliveries SET status = ?, attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status != ?')
    .bind('processing', nowUtc, deliveryId, 'sent')
    .run();

  const sendResult = await sendPush(subscription, job.notification, config);

  if (sendResult.ok) {
    await Promise.all([
      db
        .prepare('UPDATE notification_deliveries SET status = ?, sent_at = ?, updated_at = ?, last_error = NULL WHERE id = ?')
        .bind('sent', nowUtc, nowUtc, deliveryId)
        .run(),
      db
        .prepare('UPDATE push_subscriptions SET last_success_at = ?, last_failure_at = NULL, failure_count = 0, updated_at = ? WHERE id = ?')
        .bind(nowUtc, nowUtc, subscription.id)
        .run(),
    ]);

    return 'sent';
  }

  const isPermanentFailure = sendResult.permanentFailure || shouldDisableSubscriptionForStatus(sendResult.status);

  if (isPermanentFailure) {
    await Promise.all([
      db
        .prepare('UPDATE notification_deliveries SET status = ?, updated_at = ?, last_error = ? WHERE id = ?')
        .bind('failed', nowUtc, redactError(sendResult.error), deliveryId)
        .run(),
      db
        .prepare('UPDATE push_subscriptions SET enabled = 0, last_failure_at = ?, failure_count = failure_count + 1, updated_at = ? WHERE id = ?')
        .bind(nowUtc, nowUtc, subscription.id)
        .run(),
    ]);

    return 'invalid-subscription-disabled';
  }

  const nextStatus = shouldRetryDelivery(delivery.attempt_count + 1, false) ? 'failed' : 'skipped';

  await Promise.all([
    db
      .prepare('UPDATE notification_deliveries SET status = ?, updated_at = ?, last_error = ? WHERE id = ?')
      .bind(nextStatus, nowUtc, redactError(sendResult.error), deliveryId)
      .run(),
    db
      .prepare('UPDATE push_subscriptions SET last_failure_at = ?, failure_count = failure_count + 1, updated_at = ? WHERE id = ?')
      .bind(nowUtc, nowUtc, subscription.id)
      .run(),
  ]);

  return nextStatus === 'skipped' ? 'skipped' : 'failed';
}

export function buildDeliveryId(reminderId: string, subscriptionId: string, scheduledForUtc: string): string {
  return `delivery-${simpleHash(`${reminderId}|${subscriptionId}|${scheduledForUtc}`)}`;
}

async function readFamilyScheduleData(db: D1Database): Promise<FamilyScheduleData> {
  const [customChildren, customEvents, eventExceptions, eventReminders] = await Promise.all([
    readPayloadRows<Child>(db, 'SELECT payload FROM custom_children ORDER BY id', isChild),
    readPayloadRows<Event>(db, 'SELECT payload FROM custom_events ORDER BY id', isEvent),
    readPayloadRows<EventException>(db, 'SELECT payload FROM event_exceptions ORDER BY event_id, occurrence_date', isEventException),
    readEventReminderRows(db),
  ]);

  return { customChildren, customEvents, eventExceptions, eventReminders };
}

async function readEnabledPushSubscriptions(db: D1Database): Promise<PushSubscriptionRecord[]> {
  const { results = [] } = await db
    .prepare(
      'SELECT id, endpoint, p256dh, auth, enabled, device_label, user_agent, created_at, updated_at, last_success_at, last_failure_at, failure_count FROM push_subscriptions WHERE enabled = 1 ORDER BY created_at LIMIT 100',
    )
    .all<PushSubscriptionRow>();

  return results.map(pushSubscriptionFromRow);
}

async function readPayloadRows<T>(db: D1Database, query: string, isValid: (value: unknown) => value is T): Promise<T[]> {
  const { results = [] } = await db.prepare(query).all<PayloadRow>();

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
  const { results = [] } = await db
    .prepare(
      'SELECT id, event_id, occurrence_date, minutes_before, enabled, created_at, updated_at FROM event_reminders WHERE enabled = 1 ORDER BY occurrence_date, event_id LIMIT 500',
    )
    .all<ReminderRow>();

  return results
    .map((row): EventReminder => ({
      id: row.id,
      eventId: row.event_id,
      occurrenceDate: row.occurrence_date,
      reminderMinutesBefore: row.minutes_before as EventReminder['reminderMinutesBefore'],
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
    .filter(isEventReminder);
}

function pushSubscriptionFromRow(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    enabled: row.enabled === 1,
    deviceLabel: row.device_label,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    failureCount: row.failure_count,
  };
}

function isChild(value: unknown): value is Child {
  return typeof value === 'object' && value !== null && typeof (value as Child).id === 'string';
}

function isEvent(value: unknown): value is Event {
  return typeof value === 'object' && value !== null && typeof (value as Event).id === 'string';
}

function isEventException(value: unknown): value is EventException {
  return typeof value === 'object' && value !== null && typeof (value as EventException).eventId === 'string';
}

function isEventReminder(value: EventReminder): value is EventReminder {
  return (
    typeof value.id === 'string' &&
    typeof value.eventId === 'string' &&
    typeof value.occurrenceDate === 'string' &&
    (value.reminderMinutesBefore === 15 ||
      value.reminderMinutesBefore === 30 ||
      value.reminderMinutesBefore === 60 ||
      value.reminderMinutesBefore === 120 ||
      value.reminderMinutesBefore === 1440) &&
    value.enabled
  );
}

function redactError(error: string | undefined): string {
  return (error ?? 'Push delivery failed.').slice(0, 240);
}

function simpleHash(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
