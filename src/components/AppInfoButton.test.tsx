import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { UiPreferencesProvider } from '../i18n';
import type { AppBuildInfo } from '../services/appInfo';
import { AppInfoButton } from './AppInfoButton';

const productionBuildInfo: AppBuildInfo = {
  version: '0.12.1',
  fullSha: 'a2b0804f7c9e1234567890',
  shortSha: 'a2b0804',
  branch: 'main',
  buildTime: '2026-09-08T12:30:00.000Z',
  environment: 'production',
};

describe('AppInfoButton', () => {
  it('renders the compact info control', () => {
    const markup = renderToStaticMarkup(<AppInfoButton buildInfo={productionBuildInfo} />);

    expect(markup).toContain('class="app-info__button"');
    expect(markup).toContain('aria-label="מידע על המערכת"');
    expect(markup).toContain('ⓘ');
  });

  it('opens the info panel and displays version plus shortened build SHA', () => {
    const markup = renderToStaticMarkup(<AppInfoButton buildInfo={productionBuildInfo} defaultOpen />);

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('Family Logistics Assistant');
    expect(markup).toContain('0.12.1');
    expect(markup).toContain('a2b0804');
    expect(markup).not.toContain('a2b0804f7c9e1234567890');
  });

  it('renders production environment and branch metadata', () => {
    const markup = renderToStaticMarkup(<AppInfoButton buildInfo={productionBuildInfo} defaultOpen />);

    expect(markup).toContain('Production');
    expect(markup).toContain('main');
  });

  it('renders Hebrew labels from the translation layer', () => {
    const markup = renderToStaticMarkup(<AppInfoButton buildInfo={productionBuildInfo} defaultOpen />);

    expect(markup).toContain('מידע על המערכת');
    expect(markup).toContain('גרסה');
    expect(markup).toContain('סביבה');
    expect(markup).toContain('תאריך בנייה');
  });

  it('renders English labels from the translation layer', () => {
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
        <AppInfoButton buildInfo={productionBuildInfo} defaultOpen />
      </UiPreferencesProvider>,
    );

    expect(markup).toContain('App info');
    expect(markup).toContain('Version');
    expect(markup).toContain('Environment');
    expect(markup).toContain('Build date');
    vi.unstubAllGlobals();
  });

  it('renders Local fallback metadata without a Cloudflare SHA', () => {
    const markup = renderToStaticMarkup(
      <AppInfoButton
        buildInfo={{
          version: '0.12.1',
          fullSha: 'local',
          shortSha: 'local',
          branch: null,
          buildTime: '2026-09-08T12:30:00.000Z',
          environment: 'local',
        }}
        defaultOpen
      />,
    );

    expect(markup).toContain('Local');
    expect(markup).toContain('local');
    expect(markup).not.toContain('<dt>Branch</dt>');
  });
});
