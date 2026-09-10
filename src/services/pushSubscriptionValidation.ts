import type { PushSubscriptionRecord } from '../models';

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function isPushSubscriptionInput(value: unknown): value is PushSubscriptionInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PushSubscriptionInput>;
  const keys = candidate.keys as Partial<PushSubscriptionInput['keys']> | undefined;

  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.startsWith('https://') &&
    typeof keys === 'object' &&
    keys !== null &&
    typeof keys.p256dh === 'string' &&
    keys.p256dh.trim().length > 0 &&
    typeof keys.auth === 'string' &&
    keys.auth.trim().length > 0
  );
}

export function createPushSubscriptionRecord({
  input,
  existing,
  deviceLabel,
  userAgent,
  nowIso,
  id = createPushSubscriptionId(),
}: {
  input: PushSubscriptionInput;
  existing?: PushSubscriptionRecord | null;
  deviceLabel?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  nowIso: string;
  id?: string;
}): PushSubscriptionRecord {
  return {
    id: existing?.id ?? id,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    enabled: true,
    deviceLabel: normalizeOptionalText(deviceLabel),
    userAgent: normalizeOptionalText(userAgent),
    userId: existing?.userId ?? null,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastSuccessAt: existing?.lastSuccessAt ?? null,
    lastFailureAt: existing?.lastFailureAt ?? null,
    failureCount: existing?.failureCount ?? 0,
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();

  return normalizedValue === undefined || normalizedValue === '' ? null : normalizedValue;
}

function createPushSubscriptionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `push-${crypto.randomUUID()}`;
  }

  return `push-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
