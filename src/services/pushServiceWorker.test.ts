import { describe, expect, it } from 'vitest';

import serviceWorkerSource from '../../public/push-service-worker.js?raw';

describe('push service worker notification payload', () => {
  it('uses the server-provided notification tag and renotify flag', () => {
    expect(serviceWorkerSource).toContain('tag: payload.tag || undefined');
    expect(serviceWorkerSource).toContain('renotify: payload.renotify === true');
  });

  it('keeps the deep-link payload path controlled by the server payload', () => {
    expect(serviceWorkerSource).toContain("url: payload.url || '/'");
    expect(serviceWorkerSource).toContain('openNotificationUrl(event.notification.data && event.notification.data.url)');
  });
});
