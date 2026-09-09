import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { translations } from '../i18n';
import { PushNotificationsControl } from './PushNotificationsControl';

describe('PushNotificationsControl', () => {
  it('renders unsupported browser state without crashing', () => {
    const markup = renderToStaticMarkup(<PushNotificationsControl />);

    expect(markup).toContain(translations.he.notificationsOnThisDevice);
    expect(markup).toContain(translations.he.pushUnsupported);
  });

  it('renders denied permission state without prompting again', () => {
    vi.stubGlobal('window', { Notification: { permission: 'denied' }, PushManager: function PushManager() {} });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('Notification', { permission: 'denied' });

    const markup = renderToStaticMarkup(<PushNotificationsControl />);

    expect(markup).toContain(translations.he.pushPermissionDenied);
    expect(markup).toContain(translations.he.pushPermissionDeniedHelp);
    vi.unstubAllGlobals();
  });
});
