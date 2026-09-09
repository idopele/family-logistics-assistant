import { describe, expect, it } from 'vitest';

import { createPushSubscriptionRecord, isPushSubscriptionInput } from './pushSubscriptionValidation';

const input = {
  endpoint: 'https://push.example.test/subscription-a',
  keys: {
    p256dh: 'public-key',
    auth: 'auth-secret',
  },
};

describe('push subscription validation', () => {
  it('validates subscription endpoint and key fields', () => {
    expect(isPushSubscriptionInput(input)).toBe(true);
    expect(isPushSubscriptionInput({ ...input, endpoint: 'http://not-secure.test' })).toBe(false);
    expect(isPushSubscriptionInput({ ...input, keys: { p256dh: '', auth: 'auth-secret' } })).toBe(false);
  });

  it('creates a new enabled subscription record', () => {
    expect(
      createPushSubscriptionRecord({
        input,
        nowIso: '2026-09-09T08:00:00.000Z',
        id: 'push-test',
        deviceLabel: 'Laptop',
        userAgent: 'Browser',
      }),
    ).toMatchObject({
      id: 'push-test',
      endpoint: input.endpoint,
      enabled: true,
      deviceLabel: 'Laptop',
      userAgent: 'Browser',
      failureCount: 0,
    });
  });

  it('upserts duplicate endpoints by preserving the existing record id', () => {
    const existing = createPushSubscriptionRecord({
      input,
      nowIso: '2026-09-09T08:00:00.000Z',
      id: 'push-existing',
    });
    const updated = createPushSubscriptionRecord({
      input: { ...input, keys: { p256dh: 'new-public-key', auth: 'new-auth' } },
      existing,
      nowIso: '2026-09-09T09:00:00.000Z',
      id: 'push-new',
    });

    expect(updated.id).toBe('push-existing');
    expect(updated.p256dh).toBe('new-public-key');
    expect(updated.createdAt).toBe('2026-09-09T08:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-09-09T09:00:00.000Z');
  });
});
