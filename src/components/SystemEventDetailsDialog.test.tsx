import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { SystemCalendarEvent } from '../models';
import { SystemEventDetailsDialog } from './SystemEventDetailsDialog';

const event: SystemCalendarEvent = {
  id: 'moe_school_vacations:hanukkah-break-2026',
  source: 'moe_school_vacations',
  type: 'school_vacation',
  title: { he: 'חופשת חנוכה', en: 'Hanukkah vacation' },
  startDate: '2026-12-06',
  endDate: '2026-12-12',
  allDay: true,
  description: { he: 'חופשה רשמית', en: 'Official vacation' },
  sourceUrl: 'https://pop.education.gov.il/maagal_hashana/vacation-schedule/',
  sourceReference: 'Ministry circular 0363',
  appliesToAllParticipants: false,
  participantIds: ['daniel', 'emanuel'],
  metadata: {
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceName: { he: 'משרד החינוך', en: 'Ministry of Education' },
    lastVerifiedAt: '2026-09-02',
    readOnly: true,
  },
};

describe('SystemEventDetailsDialog', () => {
  it('renders source metadata and no edit/delete actions', () => {
    const markup = renderToStaticMarkup(<SystemEventDetailsDialog event={event} onClose={() => undefined} />);

    expect(markup).toContain('חופשת חנוכה');
    expect(markup).toContain('Ministry circular 0363');
    expect(markup).toContain('קריאה בלבד');
    expect(markup).not.toContain('עריכת');
    expect(markup).not.toContain('מחיקת');
  });
});
