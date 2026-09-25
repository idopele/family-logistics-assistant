import { describe, expect, it } from 'vitest';
import type { Event } from '../models';
import { getOccurrencesForRange } from './scheduleEngine';
import { getSundayOfWeek, parseWeeklyScheduleText } from './weeklyScheduleTextParser';
import { importRowToEvent, isImportedFromSource } from './scheduleImport';

const sampleText = [
  '\u05dc\u05d5\u05f4\u05d6',
  '\u05e9\u05d1\u05ea 16:00',
  '\u05d9\u05d5\u05dd \u05e8\u05d0\u05e9\u05d5\u05df 09:00 \u05e8\u05dc\u05e3',
  '\u05e9\u05dc\u05d9\u05e9\u05d9 19:00 \u05e8\u05dc\u05e3',
  '\u05e8\u05d1\u05d9\u05e2\u05d9 17:15 \u05d0\u05ea\u05dc\u05d8\u05d9\u05e7\u05d4',
  '          18:00 \u05e8\u05dc\u05e3',
  '\u05d7\u05de\u05d9\u05e9\u05d9 \u05de\u05e9\u05d7\u05e7 \u05d0\u05d9\u05de\u05d5\u05df \u05d1\u05d4\u05d5\u05d3 \u05d4\u05e9\u05e8\u05d5\u05df \u05d0\u05e2\u05d3\u05db\u05df \u05e9\u05e2\u05ea \u05d4\u05e1\u05e2\u05d4',
].join('\n');

describe('weekly WhatsApp schedule parser', () => {
  it('resolves Hebrew weekdays to exact dates in the selected target week', () => {
    const rows = parseWeeklyScheduleText({
      text: sampleText,
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });

    expect(rows.map((row) => row.date)).toEqual([
      '2026-10-03',
      '2026-09-27',
      '2026-09-29',
      '2026-09-30',
      '2026-09-30',
      '2026-10-01',
    ]);
  });

  it('supports continuation lines that inherit the previous weekday', () => {
    const rows = parseWeeklyScheduleText({
      text: '\u05e8\u05d1\u05d9\u05e2\u05d9 17:15 \u05d0\u05ea\u05dc\u05d8\u05d9\u05e7\u05d4\n18:00 \u05e8\u05dc\u05e3',
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });

    expect(rows).toMatchObject([
      { weekday: 3, startTime: '17:15', title: '\u05d0\u05ea\u05dc\u05d8\u05d9\u05e7\u05d4' },
      { weekday: 3, startTime: '18:00', title: '\u05d0\u05d9\u05de\u05d5\u05df \u05db\u05d3\u05d5\u05e8\u05e1\u05dc', location: '\u05e8\u05dc\u05e3' },
    ]);
  });

  it('marks continuation lines without a previous weekday invalid', () => {
    const rows = parseWeeklyScheduleText({
      text: '18:00 \u05e8\u05dc\u05e3',
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });

    expect(rows[0]).toMatchObject({ status: 'invalid', selected: false, messages: expect.arrayContaining(['Invalid weekday']) });
  });

  it('marks missing-time rows invalid but preserves known game details', () => {
    const rows = parseWeeklyScheduleText({
      text: '\u05d7\u05de\u05d9\u05e9\u05d9 \u05de\u05e9\u05d7\u05e7 \u05d0\u05d9\u05de\u05d5\u05df \u05d1\u05d4\u05d5\u05d3 \u05d4\u05e9\u05e8\u05d5\u05df \u05d0\u05e2\u05d3\u05db\u05df \u05e9\u05e2\u05ea \u05d4\u05e1\u05e2\u05d4',
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });

    expect(rows[0]).toMatchObject({
      date: '2026-10-01',
      startTime: '',
      title: '\u05de\u05e9\u05d7\u05e7 \u05d0\u05d9\u05de\u05d5\u05df',
      location: '\u05d4\u05d5\u05d3 \u05d4\u05e9\u05e8\u05d5\u05df',
      notes: '\u05d0\u05e2\u05d3\u05db\u05df \u05e9\u05e2\u05ea \u05d4\u05e1\u05e2\u05d4',
      status: 'invalid',
    });
  });

  it('detects time after weekday and descriptive departure text', () => {
    const rows = parseWeeklyScheduleText({
      text: 'יום חמישי טורניר ברמת גן יציאה בשעה 13:20',
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });

    expect(rows[0]).toMatchObject({
      weekday: 4,
      date: '2026-10-01',
      startTime: '13:20',
      title: 'יציאה לטורניר ברמת גן',
      location: 'רמת גן',
      status: 'ready',
    });
  });

  it('detects time anywhere in description-first weekday lines', () => {
    const rows = parseWeeklyScheduleText({
      text: [
        'חמישי טורניר ברמת גן יציאה 13:20',
        'חמישי 13:20 טורניר ברמת גן',
        'יום חמישי - יציאה לטורניר ברמת גן בשעה 13:20',
      ].join('\n'),
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });

    expect(rows.map((row) => row.startTime)).toEqual(['13:20', '13:20', '13:20']);
    expect(rows.every((row) => row.weekday === 4)).toBe(true);
  });

  it('creates one-time WhatsApp imports, not recurring events', () => {
    const [row] = parseWeeklyScheduleText({
      text: '\u05e8\u05d0\u05e9\u05d5\u05df 09:00 \u05e8\u05dc\u05e3',
      targetWeekStart: '2026-09-27',
      defaultCategory: 'basketball',
    });
    const event = importRowToEvent({
      row: row!,
      targetMemberId: 'daniel',
      defaultCategory: 'basketball',
      mode: 'dated',
      batchId: 'whatsapp-a',
      nowIso: '2026-09-22T00:00:00.000Z',
    });

    expect(event?.date).toBe('2026-09-27');
    expect(event?.recurrence).toBeNull();
    expect(event?.category).toBe('basketball');
    expect(event?.participantIds).toEqual(['daniel']);
    expect(event?.notes).toContain('import_source:whatsapp_weekly');
    expect(getOccurrencesForRange([event!], [], '2026-09-27', '2026-09-27')).toHaveLength(1);
  });

  it('identifies only WhatsApp weekly imports as replaceable and preserves official games', () => {
    const officialGame = event('official-game', '2026-09-29', '19:00', 'Game', 'official_game_csv');
    const whatsappTraining = event('whatsapp-training', '2026-09-29', '19:00', 'אימון כדורסל', 'whatsapp_weekly');
    const weekStart = getSundayOfWeek('2026-09-29');

    const replaceable = [officialGame, whatsappTraining].filter((candidate) =>
      candidate.childId === 'daniel' &&
      candidate.category === 'basketball' &&
      candidate.date !== null &&
      candidate.date >= weekStart &&
      candidate.date <= '2026-10-03' &&
      isImportedFromSource(candidate, 'whatsapp_weekly')
    );

    expect(replaceable.map((candidate) => candidate.id)).toEqual(['whatsapp-training']);
  });
});

function event(
  id: string,
  date: string,
  startTime: string,
  title: string,
  sourceKind: 'official_game_csv' | 'whatsapp_weekly',
): Event {
  return {
    id,
    childId: 'daniel',
    title,
    category: 'basketball',
    customCategoryLabel: null,
    date,
    startTime,
    endTime: null,
    endsNextDay: false,
    location: null,
    notes: `csv_import:batch\nimport_source:${sourceKind}`,
    recurrence: null,
    requiresTransportation: false,
    pickupTime: null,
    dropoffTime: null,
    status: 'scheduled',
    createdAt: '2026-09-22T00:00:00.000Z',
    updatedAt: '2026-09-22T00:00:00.000Z',
  };
}
