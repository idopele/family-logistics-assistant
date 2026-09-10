import { describe, expect, it } from 'vitest';

import indexHtml from '../../index.html?raw';
import manifestSource from '../../public/manifest.webmanifest?raw';
import serviceWorkerSource from '../../public/push-service-worker.js?raw';
import pushNotificationsSource from './pushNotifications.ts?raw';

describe('PWA readiness metadata', () => {
  const manifest = JSON.parse(manifestSource) as {
    name: string;
    short_name: string;
    start_url: string;
    scope: string;
    display: string;
    orientation: string;
    theme_color: string;
    background_color: string;
    icons: Array<{ src: string; sizes: string; purpose?: string }>;
  };

  it('defines an installable web app manifest', () => {
    expect(manifest).toMatchObject({
      name: 'Family Logistics Assistant',
      short_name: 'Family Logistics',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      orientation: 'any',
      theme_color: '#24433f',
      background_color: '#f3f1ed',
    });
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === '512x512')).toBe(true);
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('links the manifest and mobile home-screen metadata from the HTML head', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.webmanifest" crossorigin="use-credentials" />');
    expect(indexHtml).toContain('crossorigin="use-credentials"');
    expect(indexHtml).toContain('<meta name="theme-color" content="#24433f" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/icons/icon-192.svg" />');
  });

  it('keeps a single push service worker registration path', () => {
    expect(pushNotificationsSource).toContain("const serviceWorkerPath = '/push-service-worker.js'");
    expect(pushNotificationsSource).toContain('navigator.serviceWorker.register(serviceWorkerPath, { scope: \'/\' })');
    expect(pushNotificationsSource.match(/serviceWorker\.register/g) ?? []).toHaveLength(1);
  });

  it('preserves notification deep links and avoids aggressive cache-first behavior', () => {
    expect(serviceWorkerSource).toContain("url: payload.url || '/'");
    expect(serviceWorkerSource).toContain('clients.openWindow(targetUrl)');
    expect(serviceWorkerSource).not.toContain("addEventListener('fetch'");
    expect(serviceWorkerSource).not.toContain('caches.open');
    expect(serviceWorkerSource).not.toContain('cache-first');
  });
});
