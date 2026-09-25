import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { translations } from '../i18n';
import { HomePage } from './HomePage';

describe('HomePage mobile PWA header readiness', () => {
  it('keeps primary header actions and notification access available', () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain(translations.he.appName);
    expect(markup).toContain(translations.he.addEvent);
    expect(markup).toContain(translations.he.appInfo);
    expect(markup).toContain(translations.he.calendarSources);
    expect(markup).toContain('class="app-info__button"');
  });
});
