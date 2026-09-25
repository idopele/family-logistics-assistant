import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Child, ScheduleOccurrence } from '../models';
import { DaySchedule } from './DaySchedule';

const child: Child = {
  id: 'daniel',
  name: 'דניאל',
  color: '#2563EB',
  isActive: true,
};

const schoolOccurrence: ScheduleOccurrence = {
  eventId: 'seed-school-a',
  childId: 'daniel',
  date: '2026-09-08',
  title: 'מתמטיקה',
  category: 'school',
  customCategoryLabel: null,
  startTime: '08:00',
  endTime: '08:45',
  endsNextDay: false,
  location: 'בית ספר',
  notes: null,
  status: 'scheduled',
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  isException: false,
};

describe('DaySchedule', () => {
  it('renders compact school occurrences as selectable rows for editing', () => {
    const markup = renderToStaticMarkup(
      <DaySchedule
        label="שלישי"
        date="2026-09-08"
        occurrences={[schoolOccurrence]}
        childrenById={new Map([[child.id, child]])}
        childFilter="all"
        editableEventIds={new Set()}
        customRecurringEventIds={new Set()}
        transportationPlansByOccurrence={new Map()}
        onOccurrenceSelect={() => undefined}
        isToday={false}
      />,
    );

    expect(markup).toContain('school-row--button');
    expect(markup).toContain('type="button"');
    expect(markup).toContain('מתמטיקה');
  });

  it('renders read-only system calendar banners separately from timed cards', () => {
    const markup = renderToStaticMarkup(
      <DaySchedule
        label="שבת"
        date="2026-09-12"
        occurrences={[]}
        systemEvents={[
          {
            id: 'israel_holidays:rosh-hashana-5787',
            source: 'israel_holidays',
            type: 'holiday',
            title: { he: 'ראש השנה', en: 'Rosh Hashana' },
            startDate: '2026-09-12',
            endDate: '2026-09-12',
            allDay: true,
            description: null,
            sourceUrl: null,
            sourceReference: null,
            appliesToAllParticipants: true,
            participantIds: [],
            metadata: {
              sourceName: { he: 'Hebcal', en: 'Hebcal' },
              lastVerifiedAt: '2026-09-23',
              readOnly: true,
            },
          },
        ]}
        childrenById={new Map([[child.id, child]])}
        childFilter="all"
        editableEventIds={new Set()}
        customRecurringEventIds={new Set()}
        transportationPlansByOccurrence={new Map()}
        onOccurrenceSelect={() => undefined}
        onSystemEventSelect={() => undefined}
        isToday={false}
      />,
    );

    expect(markup).toContain('system-calendar-banner');
    expect(markup).toContain('ראש השנה');
    expect(markup).not.toContain('event-card');
  });
});
