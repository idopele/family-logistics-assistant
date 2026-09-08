import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { UiPreferencesProvider, translations } from '../i18n';
import type { Child, Event, ScheduleOccurrence } from '../models';
import { AddEventDialog } from './AddEventDialog';
import { EventDetailsDialog } from './EventDetailsDialog';

const child: Child = {
  id: 'daniel',
  name: 'Daniel',
  color: '#2563EB',
  isActive: true,
};

const event: Event = {
  id: 'event-a',
  childId: 'daniel',
  title: 'Doctor',
  category: 'doctor',
  customCategoryLabel: null,
  date: '2026-09-08',
  startTime: '15:20',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-08T10:00:00.000Z',
  updatedAt: '2026-09-08T10:00:00.000Z',
};

const occurrence: ScheduleOccurrence = {
  eventId: event.id,
  childId: event.childId,
  date: '2026-09-08',
  title: event.title,
  category: event.category,
  customCategoryLabel: event.customCategoryLabel,
  startTime: event.startTime,
  endTime: event.endTime,
  endsNextDay: event.endsNextDay,
  location: event.location,
  notes: event.notes,
  status: event.status,
  requiresTransportation: event.requiresTransportation,
  pickupTime: event.pickupTime,
  dropoffTime: event.dropoffTime,
  isException: false,
};

describe('reminder and deep-link dialog UI', () => {
  it('Add Event displays the reminder selector in create mode', () => {
    const markup = renderToStaticMarkup(
      <AddEventDialog isOpen children={[child]} onClose={() => undefined} onSave={() => ({ ok: true })} />,
    );

    expect(markup).toContain(translations.he.reminder);
    expect(markup).toContain(translations.he.noReminder);
    expect(markup).toContain(translations.he.reminder30Before);
  });

  it('EventDetailsDialog exposes the Hebrew Copy event link action', () => {
    const markup = renderToStaticMarkup(
      <EventDetailsDialog
        event={event}
        occurrence={occurrence}
        child={child}
        transportationPlan={null}
        reminder={null}
        canEditEvent={false}
        canEditOccurrence={false}
        canEditSeries={false}
        canDeleteEvent={false}
        canCancelOccurrence={false}
        canDeleteSeries={false}
        onClose={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onEditOccurrence={() => undefined}
        onCancelOccurrence={() => undefined}
        onEditSeries={() => undefined}
        onDeleteSeries={() => undefined}
        onOpenTransportation={() => undefined}
        onReminderChange={() => undefined}
      />,
    );

    expect(markup).toContain(translations.he.copyEventLink);
  });

  it('EventDetailsDialog exposes the English Copy event link action', () => {
    const storage = { getItem: () => 'en', setItem: () => undefined, removeItem: () => undefined, clear: () => undefined, key: () => null, length: 0 };

    globalThis.localStorage = storage as Storage;

    const markup = renderToStaticMarkup(
      <UiPreferencesProvider>
        <EventDetailsDialog
          event={event}
          occurrence={occurrence}
          child={child}
          transportationPlan={null}
          reminder={null}
          canEditEvent={false}
          canEditOccurrence={false}
          canEditSeries={false}
          canDeleteEvent={false}
          canCancelOccurrence={false}
          canDeleteSeries={false}
          onClose={() => undefined}
          onEdit={() => undefined}
          onDelete={() => undefined}
          onEditOccurrence={() => undefined}
          onCancelOccurrence={() => undefined}
          onEditSeries={() => undefined}
          onDeleteSeries={() => undefined}
          onOpenTransportation={() => undefined}
          onReminderChange={() => undefined}
        />
      </UiPreferencesProvider>,
    );

    expect(markup).toContain('Copy event link');
  });
});