import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendNotification } from 'web-push-neo';

import type { PushNotificationPayload } from './notificationScheduling';
import { mapSubscriptionToWebPushNeo, sendWebPushNotification, stringifyPushPayload } from './webPush';

vi.mock('web-push-neo', () => ({
  sendNotification: vi.fn(),
}));

const subscription = {
  endpoint: 'https://push.example.test/subscription-a',
  p256dh: 'public-key',
  auth: 'auth-secret',
};
const payload: PushNotificationPayload = {
  title: 'Family Logistics Assistant',
  body: 'Notifications are working on this device.',
  url: '/',
  tag: 'family-logistics-test',
};
const config = {
  vapidPublicKey: 'current-public-key',
  vapidPrivateKey: 'current-private-key',
  vapidSubject: 'mailto:family@example.test',
};

describe('web-push-neo sender wrapper', () => {
  beforeEach(() => {
    vi.mocked(sendNotification).mockReset();
  });

  it('maps the stored D1 subscription into the standard web-push-neo shape', () => {
    expect(mapSubscriptionToWebPushNeo(subscription)).toEqual({
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    });
  });

  it('stringifies the JSON payload exactly once', () => {
    const serializedPayload = stringifyPushPayload(payload);

    expect(JSON.parse(serializedPayload)).toEqual(payload);
    expect(serializedPayload).not.toContain('"{');
  });

  it('passes existing VAPID values to web-push-neo', async () => {
    vi.mocked(sendNotification).mockResolvedValue({ statusCode: 201, headers: new Headers(), body: '' });

    await sendWebPushNotification(subscription, payload, config);

    expect(sendNotification).toHaveBeenCalledWith(
      mapSubscriptionToWebPushNeo(subscription),
      stringifyPushPayload(payload),
      expect.objectContaining({
        vapidDetails: {
          subject: config.vapidSubject,
          publicKey: config.vapidPublicKey,
          privateKey: config.vapidPrivateKey,
        },
      }),
    );
  });

  it('reports provider success status as success', async () => {
    vi.mocked(sendNotification).mockResolvedValue({ statusCode: 201, headers: new Headers(), body: '' });

    await expect(sendWebPushNotification(subscription, payload, config)).resolves.toMatchObject({
      ok: true,
      status: 201,
      permanentFailure: false,
    });
  });

  it('reports provider errors as failures', async () => {
    vi.mocked(sendNotification).mockRejectedValue({ statusCode: 503, message: 'temporary' });

    await expect(sendWebPushNotification(subscription, payload, config)).resolves.toMatchObject({
      ok: false,
      status: 503,
      permanentFailure: false,
      error: 'Push service returned 503',
    });
  });

  it('marks 404 and 410 provider errors as permanent failures', async () => {
    vi.mocked(sendNotification).mockRejectedValueOnce({ statusCode: 404 });
    await expect(sendWebPushNotification(subscription, payload, config)).resolves.toMatchObject({
      ok: false,
      status: 404,
      permanentFailure: true,
    });

    vi.mocked(sendNotification).mockRejectedValueOnce({ statusCode: 410 });
    await expect(sendWebPushNotification(subscription, payload, config)).resolves.toMatchObject({
      ok: false,
      status: 410,
      permanentFailure: true,
    });
  });
});
