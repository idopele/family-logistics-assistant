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
});
