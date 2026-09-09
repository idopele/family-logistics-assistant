import { sendNotification, type PushSubscription as WebPushNeoSubscription } from 'web-push-neo';
import type { PushSubscriptionRecord } from '../models';
import type { PushNotificationPayload } from './notificationScheduling';

export interface WebPushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

export interface WebPushSendResult {
  ok: boolean;
  status: number;
  permanentFailure: boolean;
  error?: string;
}

type WebPushNeoError = {
  statusCode?: unknown;
  message?: unknown;
};

export async function sendWebPushNotification(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
  payload: PushNotificationPayload,
  config: WebPushConfig,
): Promise<WebPushSendResult> {
  try {
    const result = await sendNotification(mapSubscriptionToWebPushNeo(subscription), stringifyPushPayload(payload), {
      vapidDetails: {
        subject: config.vapidSubject,
        publicKey: config.vapidPublicKey,
        privateKey: config.vapidPrivateKey,
      },
      urgency: 'normal',
      TTL: 2419200,
    });
    const status = typeof result.statusCode === 'number' ? result.statusCode : 201;

    return {
      ok: status >= 200 && status < 300,
      status,
      permanentFailure: status === 404 || status === 410,
      error: status >= 200 && status < 300 ? undefined : `Push service returned ${status}`,
    };
  } catch (error) {
    const status = getProviderStatus(error);

    return {
      ok: false,
      status,
      permanentFailure: status === 404 || status === 410,
      error: normalizeWebPushError(error),
    };
  }
}

export function mapSubscriptionToWebPushNeo(
  subscription: Pick<PushSubscriptionRecord, 'endpoint' | 'p256dh' | 'auth'>,
): WebPushNeoSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export function stringifyPushPayload(payload: PushNotificationPayload): string {
  return JSON.stringify(payload);
}

function getProviderStatus(error: unknown): number {
  const statusCode = (error as WebPushNeoError | null)?.statusCode;

  return typeof statusCode === 'number' ? statusCode : 0;
}

function normalizeWebPushError(error: unknown): string {
  const webPushError = error as WebPushNeoError | null;
  const status = getProviderStatus(error);

  if (status > 0) {
    return `Push service returned ${status}`;
  }

  return typeof webPushError?.message === 'string' && webPushError.message.trim() !== ''
    ? webPushError.message.slice(0, 160)
    : 'Web Push request failed';
}
