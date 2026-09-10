import { describe, expect, it } from 'vitest';

import { buildTestNotificationPayload, buildTestPushResponseBody, parsePushMutationRequest } from './push';

const subscription = {
  endpoint: 'https://push.example.test/subscription',
  keys: {
    p256dh: 'public-key',
    auth: 'auth-secret',
  },
};

describe('push API request parsing', () => {
  it('accepts a valid register subscription mutation', () => {
    expect(
      parsePushMutationRequest({
        action: 'registerSubscription',
        payload: { subscription },
      }),
    ).toMatchObject({ action: 'registerSubscription' });
  });

  it('rejects invalid subscription writes', () => {
    expect(
      parsePushMutationRequest({
        action: 'registerSubscription',
        payload: { subscription: { ...subscription, endpoint: 'http://not-secure.test' } },
      }),
    ).toBeNull();
    expect(
      parsePushMutationRequest({
        action: 'registerSubscription',
        payload: { subscription: { endpoint: subscription.endpoint, keys: { p256dh: '', auth: '' } } },
      }),
    ).toBeNull();
  });

  it('accepts disable subscription and server test notification actions', () => {
    expect(
      parsePushMutationRequest({
        action: 'disableSubscription',
        payload: { endpoint: subscription.endpoint },
      }),
    ).toMatchObject({ action: 'disableSubscription' });
    expect(
      parsePushMutationRequest({
        action: 'sendTestNotification',
        payload: { endpoint: subscription.endpoint, language: 'en' },
      }),
    ).toMatchObject({ action: 'sendTestNotification' });
  });

  it('builds localized server-originated test push payloads', () => {
    expect(buildTestNotificationPayload('en', 'test-1')).toMatchObject({
      title: 'Family Logistics Assistant',
      body: 'Notifications are working on this device.',
      url: '/',
      tag: 'family-logistics-test-test-1',
    });
    expect(buildTestNotificationPayload('he', 'test-2').body).toBe('ההתראות פועלות במכשיר זה.');
  });

  it('creates a unique notification tag for each manual test send', () => {
    const firstPayload = buildTestNotificationPayload('en');
    const secondPayload = buildTestNotificationPayload('en');

    expect(firstPayload.tag).toMatch(/^family-logistics-test-/);
    expect(secondPayload.tag).toMatch(/^family-logistics-test-/);
    expect(firstPayload.tag).not.toBe(secondPayload.tag);
  });

  it('returns safe provider diagnostics for test push success and failure', () => {
    expect(buildTestPushResponseBody({ ok: true, status: 201, permanentFailure: false })).toEqual({
      ok: true,
      providerStatus: 201,
    });
    expect(buildTestPushResponseBody({ ok: false, status: 410, permanentFailure: true, error: 'Push service returned 410' })).toEqual({
      ok: false,
      providerStatus: 410,
      error: 'Push service returned 410',
    });
  });
});
