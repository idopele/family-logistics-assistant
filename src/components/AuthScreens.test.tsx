import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { UiPreferencesProvider, translations } from '../i18n';
import { BootstrapOwnerScreen, LoginScreen } from './AuthScreens';

describe('AuthScreens readability hooks and labels', () => {
  it('renders login Email and Password labels with auth-specific readable classes', () => {
    const markup = renderToStaticMarkup(<LoginScreen onAuthenticated={() => undefined} />);

    expect(markup).toContain(translations.he.email);
    expect(markup).toContain(translations.he.password);
    expect(markup).toContain('class="form-field auth-form-field"');
    expect(markup).toContain('class="auth-form-field__label"');
    expect(markup).toContain('class="auth-form-field__input"');
    expect(markup).toContain('class="add-event-form__save auth-form__submit"');
  });

  it('renders all bootstrap field labels with auth-specific readable classes', () => {
    const markup = renderToStaticMarkup(<BootstrapOwnerScreen onAuthenticated={() => undefined} />);

    expect(markup).toContain(translations.he.displayName);
    expect(markup).toContain(translations.he.email);
    expect(markup).toContain(translations.he.password);
    expect(markup).toContain(translations.he.bootstrapToken);
    expect(markup.match(/class="auth-form-field__label"/g)).toHaveLength(4);
  });

  it('keeps Hebrew and English auth labels available through the translation layer', () => {
    expect(translations.he.email).toBe('\u05d0\u05d9\u05de\u05d9\u05d9\u05dc');
    expect(translations.he.password).toBe('\u05e1\u05d9\u05e1\u05de\u05d4');
    expect(translations.en.email).toBe('Email');
    expect(translations.en.password).toBe('Password');
  });

  it('renders English login labels without changing authentication behavior', () => {
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
        <LoginScreen onAuthenticated={() => undefined} />
      </UiPreferencesProvider>,
    );

    expect(markup).toContain('Email');
    expect(markup).toContain('Password');
    expect(markup).not.toContain('/api/auth/login');
    vi.unstubAllGlobals();
  });
});
