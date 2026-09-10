import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { UiPreferencesProvider, translations } from '../i18n';
import type { BrowserInstallPromptEvent } from '../services/pwaInstall';
import { PwaInstallControl } from './PwaInstallControl';

const promptEvent = { prompt: async () => undefined } as BrowserInstallPromptEvent;

describe('PwaInstallControl', () => {
  it('renders Hebrew install labels when browser install is available', () => {
    const markup = renderToStaticMarkup(<PwaInstallControl defaultPromptEvent={promptEvent} defaultDismissed={false} />);

    expect(markup).toContain('class="pwa-install"');
    expect(markup).toContain(translations.he.installApp);
    expect(markup).toContain(`aria-label="${translations.he.dismissInstallPrompt}"`);
  });

  it('renders English install labels through the translation layer', () => {
    const storage = {
      getItem: vi.fn((key: string) => (key === 'family-logistics-ui-language-v1' ? 'en' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };
    vi.stubGlobal('localStorage', storage);

    const markup = renderToStaticMarkup(
      <UiPreferencesProvider>
        <PwaInstallControl defaultPromptEvent={promptEvent} defaultDismissed={false} />
      </UiPreferencesProvider>,
    );

    expect(markup).toContain('Install app');
    expect(markup).toContain('Dismiss install prompt');
    vi.unstubAllGlobals();
  });

  it('does not render install UI when install is unavailable or dismissed', () => {
    expect(renderToStaticMarkup(<PwaInstallControl defaultDismissed={false} defaultShowIosGuidance={false} />)).toBe('');
    expect(renderToStaticMarkup(<PwaInstallControl defaultPromptEvent={promptEvent} defaultDismissed />)).toBe('');
  });

  it('renders iOS guidance only when requested by the environment heuristic', () => {
    const markup = renderToStaticMarkup(<PwaInstallControl defaultDismissed={false} defaultShowIosGuidance />);

    expect(markup).toContain(translations.he.iosInstallGuidance);
    expect(renderToStaticMarkup(<PwaInstallControl defaultDismissed={false} defaultShowIosGuidance={false} />)).toBe('');
  });
});
