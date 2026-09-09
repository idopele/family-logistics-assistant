import type { Language } from '../i18n';
import { base64UrlToUint8Array } from '../utils/base64Url';

export type DevicePushStatus = 'not-enabled' | 'enabled' | 'permission-denied' | 'unsupported';

type Fetcher = typeof fetch;

const pushApiPath = '/api/push';
const serviceWorkerPath = '/push-service-worker.js';

export function getDevicePushSupportStatus(): DevicePushStatus {
  if (!isPushSupported()) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') {
    return 'permission-denied';
  }

  return 'not-enabled';
}

export async function getCurrentDevicePushStatus(): Promise<DevicePushStatus> {
  if (!isPushSupported()) {
    return 'unsupported';
  }

  if (Notification.permission === 'denied') {
    return 'permission-denied';
  }

  const registration = await navigator.serviceWorker.getRegistration(serviceWorkerPath);
  const subscription = await registration?.pushManager.getSubscription();

  return subscription === undefined || subscription === null ? 'not-enabled' : 'enabled';
}

export async function enablePushNotifications(language: Language, fetcher: Fetcher = fetch): Promise<DevicePushStatus> {
  if (!isPushSupported()) {
    return 'unsupported';
  }

  const permission = await Notification.requestPermission();

  if (permission === 'denied') {
    return 'permission-denied';
  }

  if (permission !== 'granted') {
    return 'not-enabled';
  }

  const publicKey = await fetchVapidPublicKey(fetcher);
  const registration = await navigator.serviceWorker.register(serviceWorkerPath, { scope: '/' });
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    }));

  await registerPushSubscription(subscription, language, fetcher);

  return 'enabled';
}

export async function disablePushNotifications(fetcher: Fetcher = fetch): Promise<DevicePushStatus> {
  if (!isPushSupported()) {
    return 'unsupported';
  }

  const registration = await navigator.serviceWorker.getRegistration(serviceWorkerPath);
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription !== undefined && subscription !== null) {
    await disablePushSubscription(subscription, fetcher);
    await subscription.unsubscribe();
  }

  return Notification.permission === 'denied' ? 'permission-denied' : 'not-enabled';
}

export async function sendPushTestNotification(language: Language, fetcher: Fetcher = fetch): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are unsupported.');
  }

  const registration = await navigator.serviceWorker.getRegistration(serviceWorkerPath);
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription === undefined || subscription === null) {
    throw new Error('This device is not subscribed.');
  }

  const response = await fetcher(pushApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      action: 'sendTestNotification',
      payload: {
        endpoint: subscription.endpoint,
        language,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Could not send test notification.');
  }
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

async function fetchVapidPublicKey(fetcher: Fetcher): Promise<string> {
  const response = await fetcher(pushApiPath, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Push notifications are not configured.');
  }

  const payload: unknown = await response.json();

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as { publicKey?: unknown }).publicKey !== 'string' ||
    (payload as { publicKey: string }).publicKey.trim() === ''
  ) {
    throw new Error('Push notification configuration is invalid.');
  }

  return (payload as { publicKey: string }).publicKey;
}

async function registerPushSubscription(subscription: PushSubscription, language: Language, fetcher: Fetcher): Promise<void> {
  const response = await fetcher(pushApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      action: 'registerSubscription',
      payload: {
        subscription: subscription.toJSON(),
        deviceLabel: language === 'he' ? 'דפדפן משפחתי' : 'Family browser',
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Could not register this device for notifications.');
  }
}

async function disablePushSubscription(subscription: PushSubscription, fetcher: Fetcher): Promise<void> {
  const response = await fetcher(pushApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      action: 'disableSubscription',
      payload: {
        endpoint: subscription.endpoint,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Could not disable notifications for this device.');
  }
}
