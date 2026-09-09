import { describe, expect, it } from 'vitest';

import { buildTestNotificationPayload, parsePushMutationRequest } from './push';

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
    expect(buildTestNotificationPayload('en')).toMatchObject({
      title: 'Family Logistics Assistant',
      body: 'Notifications are working on this device.',
      url: '/',
    });
    expect(buildTestNotificationPayload('he').body).toBe('ההתראות פועלות במכשיר זה.');
  });
});
