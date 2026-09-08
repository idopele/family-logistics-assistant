import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { EventReminder } from '../models';
import { ReminderIndicator } from './ReminderIndicator';

const reminder: EventReminder = {
  id: 'reminder-a',
  eventId: 'event-a',
  occurrenceDate: '2026-09-08',
  reminderMinutesBefore: 30,
  enabled: true,
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};

describe('ReminderIndicator', () => {
  it('renders a subtle accessible reminder indicator when enabled', () => {
    const markup = renderToStaticMarkup(<ReminderIndicator reminder={reminder} />);

    expect(markup).toContain('class="reminder-indicator"');
    expect(markup).toContain('aria-label=');
  });

  it('renders nothing for a missing or disabled reminder', () => {
    expect(renderToStaticMarkup(<ReminderIndicator reminder={null} />)).toBe('');
    expect(renderToStaticMarkup(<ReminderIndicator reminder={{ ...reminder, enabled: false }} />)).toBe('');
  });
});