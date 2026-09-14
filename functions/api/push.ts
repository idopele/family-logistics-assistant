import type { PushSubscriptionRecord } from '../../src/models';
import type { PushNotificationPayload } from '../../src/services/notificationScheduling';
import { createPushSubscriptionRecord, isPushSubscriptionInput, type PushSubscriptionInput } from '../../src/services/pushSubscriptionValidation';
import { sendWebPushNotification, type WebPushConfig, type WebPushSendResult } from '../../src/services/webPush';
import { associatePushSubscriptionWithUser } from './authCore';
import { requireAppSession } from './authGuard';
import { hasPermission, readAuthorizationContext } from './permissions';

type D1Value = string | number | null;

type D1PreparedStatement = {
  bind: (...values: D1Value[]) => D1PreparedStatement;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

type PagesContext = {
  request: Request;
  env: {
    FAMILY_DB?: D1Database;
    VAPID_PUBLIC_KEY?: string;
    VAPID_PRIVATE_KEY?: string;
    VAPID_SUBJECT?: string;
  };
};

type PushMutationRequest =
  | { action: 'registerSubscription'; payload: { subscription: PushSubscriptionInput; deviceLabel?: string | null } }
  | { action: 'disableSubscription'; payload: { endpoint: string } }
  | { action: 'sendTestNotification'; payload: { endpoint: string; language?: 'he' | 'en' } };

type PushSubscriptionRow = {
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
  user_id: string | null;
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const guard = await requireAppSession(context);

  if (guard instanceof Response) {
    return guard;
  }

  if (!context.env.VAPID_PUBLIC_KEY) {
    return jsonResponse({ error: 'Push notifications are not configured.' }, 503);
  }

  if (context.env.FAMILY_DB !== undefined && !hasPermission(await readAuthorizationContext(context.env.FAMILY_DB, guard.auth), 'receive_notifications')) {
    return jsonResponse({ error: 'Not authorized.' }, 403);
  }

  return jsonResponse({ publicKey: context.env.VAPID_PUBLIC_KEY });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const guard = await requireAppSession(context);

  if (guard instanceof Response) {
    return guard;
  }

  const db = context.env.FAMILY_DB;

  if (db === undefined) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  if (!hasPermission(await readAuthorizationContext(db, guard.auth), 'receive_notifications')) {
    return jsonResponse({ error: 'Not authorized.' }, 403);
  }

  let body: unknown;

  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON request.' }, 400);
  }

  const mutation = parsePushMutationRequest(body);

  if (mutation === null) {
    return jsonResponse({ error: 'Invalid push notification request.' }, 400);
  }

  if (mutation.action === 'registerSubscription') {
    const record = await upsertPushSubscription(
      db,
      mutation.payload.subscription,
      mutation.payload.deviceLabel ?? null,
      context.request.headers.get('user-agent'),
      new Date().toISOString(),
    );
    await associatePushSubscriptionWithUser(db, record.endpoint, guard.auth.user.id);

    return jsonResponse({ ok: true, subscriptionId: record.id, enabled: record.enabled });
  }

  if (mutation.action === 'disableSubscription') {
    await disablePushSubscription(db, mutation.payload.endpoint, new Date().toISOString());

    return jsonResponse({ ok: true });
  }

  const config = getWebPushConfig(context.env);

  if (config === null) {
    return jsonResponse({ error: 'Push notifications are not configured.' }, 503);
  }

  const subscription = await readPushSubscriptionByEndpoint(db, mutation.payload.endpoint);

  if (subscription === null || !subscription.enabled) {
    return jsonResponse({ error: 'This device is not subscribed.' }, 404);
  }

  const payload = buildTestNotificationPayload(mutation.payload.language ?? 'he');
  const sendResult = await sendWebPushNotification(subscription, payload, config);
  const nowIso = new Date().toISOString();

  if (sendResult.ok) {
    await markPushSubscriptionSuccess(db, subscription.id, nowIso);

    return jsonResponse(buildTestPushResponseBody(sendResult));
  }

  await markPushSubscriptionFailure(db, subscription.id, nowIso, sendResult.permanentFailure);

  return jsonResponse(buildTestPushResponseBody(sendResult), 502);
}

export function parsePushMutationRequest(value: unknown): PushMutationRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const request = value as { action?: unknown; payload?: unknown };

  if (typeof request.payload !== 'object' || request.payload === null) {
    return null;
  }

  const payload = request.payload as { subscription?: unknown; endpoint?: unknown; deviceLabel?: unknown; language?: unknown };

  switch (request.action) {
    case 'registerSubscription':
      return isPushSubscriptionInput(payload.subscription) &&
        (typeof payload.deviceLabel === 'string' || payload.deviceLabel === null || payload.deviceLabel === undefined)
        ? { action: request.action, payload: { subscription: payload.subscription, deviceLabel: payload.deviceLabel } }
        : null;
    case 'disableSubscription':
      return typeof payload.endpoint === 'string' && payload.endpoint.startsWith('https://')
        ? { action: request.action, payload: { endpoint: payload.endpoint } }
        : null;
    case 'sendTestNotification':
      return typeof payload.endpoint === 'string' &&
        payload.endpoint.startsWith('https://') &&
        (payload.language === 'he' || payload.language === 'en' || payload.language === undefined)
        ? { action: request.action, payload: { endpoint: payload.endpoint, language: payload.language } }
        : null;
    default:
      return null;
  }
}

export async function upsertPushSubscription(
  db: D1Database,
  input: PushSubscriptionInput,
  deviceLabel: string | null,
  userAgent: string | null,
  nowIso: string,
): Promise<PushSubscriptionRecord> {
  const existing = await readPushSubscriptionByEndpoint(db, input.endpoint);
  const record = createPushSubscriptionRecord({ input, existing, deviceLabel, userAgent, nowIso });

  await db
    .prepare(
      'INSERT INTO push_subscriptions (id, endpoint, p256dh, auth, enabled, device_label, user_agent, created_at, updated_at, last_success_at, last_failure_at, failure_count, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, enabled = excluded.enabled, device_label = excluded.device_label, user_agent = excluded.user_agent, updated_at = excluded.updated_at',
    )
    .bind(
      record.id,
      record.endpoint,
      record.p256dh,
      record.auth,
      record.enabled ? 1 : 0,
      record.deviceLabel ?? null,
      record.userAgent ?? null,
      record.createdAt,
      record.updatedAt,
      record.lastSuccessAt ?? null,
      record.lastFailureAt ?? null,
      record.failureCount,
      record.userId ?? null,
    )
    .run();

  return record;
}

export async function disablePushSubscription(db: D1Database, endpoint: string, nowIso: string): Promise<void> {
  await db.prepare('UPDATE push_subscriptions SET enabled = 0, updated_at = ? WHERE endpoint = ?').bind(nowIso, endpoint).run();
}

export async function markPushSubscriptionSuccess(db: D1Database, subscriptionId: string, nowIso: string): Promise<void> {
  await db
    .prepare('UPDATE push_subscriptions SET last_success_at = ?, last_failure_at = NULL, failure_count = 0, updated_at = ? WHERE id = ?')
    .bind(nowIso, nowIso, subscriptionId)
    .run();
}

export async function markPushSubscriptionFailure(
  db: D1Database,
  subscriptionId: string,
  nowIso: string,
  disable: boolean,
): Promise<void> {
  await db
    .prepare(
      'UPDATE push_subscriptions SET last_failure_at = ?, failure_count = failure_count + 1, enabled = CASE WHEN ? = 1 THEN 0 ELSE enabled END, updated_at = ? WHERE id = ?',
    )
    .bind(nowIso, disable ? 1 : 0, nowIso, subscriptionId)
    .run();
}

export async function readPushSubscriptionByEndpoint(db: D1Database, endpoint: string): Promise<PushSubscriptionRecord | null> {
  const row = await db
    .prepare(
      'SELECT id, endpoint, p256dh, auth, enabled, device_label, user_agent, created_at, updated_at, last_success_at, last_failure_at, failure_count, user_id FROM push_subscriptions WHERE endpoint = ?',
    )
    .bind(endpoint)
    .first<PushSubscriptionRow>();

  return row === null ? null : pushSubscriptionFromRow(row);
}

export function buildTestNotificationPayload(
  language: 'he' | 'en',
  tagSuffix = createTestNotificationTagSuffix(),
): PushNotificationPayload {
  return {
    title: 'Family Logistics Assistant',
    body: language === 'he' ? 'ההתראות פועלות במכשיר זה.' : 'Notifications are working on this device.',
    url: '/',
    tag: `family-logistics-test-${tagSuffix}`,
  };
}

export function buildTestPushResponseBody(sendResult: WebPushSendResult):
  | { ok: true; providerStatus: number }
  | { ok: false; providerStatus: number; error: string } {
  if (sendResult.ok) {
    return { ok: true, providerStatus: sendResult.status };
  }

  return {
    ok: false,
    providerStatus: sendResult.status,
    error: sendResult.error ?? 'Could not send test notification.',
  };
}

function getWebPushConfig(env: PagesContext['env']): WebPushConfig | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return null;
  }

  return {
    vapidPublicKey: env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY,
    vapidSubject: env.VAPID_SUBJECT,
  };
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
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSuccessAt: row.last_success_at,
    lastFailureAt: row.last_failure_at,
    failureCount: row.failure_count,
  };
}

function createTestNotificationTagSuffix(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
