import { describe, expect, it } from 'vitest';
import { getOccurrencesForRange } from './scheduleEngine';
import {
  buildScheduleImportRows,
  importRowToEvent,
  isImportedFromSource,
  parseCsv,
  parseImportDate,
  parseImportTime,
} from './scheduleImport';
import type { Event } from '../models';

const existingEvent: Event = {
  id: 'existing',
  childId: 'daniel',
  title: 'Training',
  category: 'basketball',
  customCategoryLabel: null,
  date: '2026-10-03',
  startTime: '18:30',
  endTime: '20:00',
  endsNextDay: false,
  location: 'Gym',
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-22T00:00:00.000Z',
  updatedAt: '2026-09-22T00:00:00.000Z',
};

describe('schedule CSV import parsing and preview', () => {
  it('parses valid dated CSV into ready rows', () => {
    const preview = buildScheduleImportRows({
      csv: 'Date,Start Time,End Time,Title,Location\n2026-10-03,18:30,20:00,Training,Gym',
      mode: 'dated',
      defaultCategory: 'basketball',
    });

    expect(preview.rows[0]).toMatchObject({
      date: '2026-10-03',
      startTime: '18:30',
      endTime: '20:00',
      title: 'Training',
      status: 'ready',
      selected: true,
    });
  });

  it('supports Hebrew headers and UTF-8 BOM', () => {
    const preview = buildScheduleImportRows({
      csv: '\uFEFFתאריך,שעה,כותרת,מיקום\n03/10/2026,18:30,אימון,אולם',
      mode: 'dated',
      defaultCategory: 'basketball',
    });

    expect(preview.rows[0]?.date).toBe('2026-10-03');
    expect(preview.rows[0]?.title).toBe('אימון');
    expect(preview.rows[0]?.location).toBe('אולם');
  });

  it('supports quoted comma fields and CRLF', () => {
    const parsed = parseCsv('Date,Start,Title,Notes\r\n2026-10-03,18:30,"Training, court A","bring ball"\r\n');

    expect(parsed.rows[0]).toEqual(['2026-10-03', '18:30', 'Training, court A', 'bring ball']);
  });

  it('normalizes supported date and time formats', () => {
    expect(parseImportDate('2026-10-03')).toBe('2026-10-03');
    expect(parseImportDate('03.10.2026')).toBe('2026-10-03');
    expect(parseImportDate('08-10-2026')).toBe('2026-10-08');
    expect(parseImportTime('18:30:00')).toBe('18:30');
    expect(parseImportTime('6:30 PM')).toBe('18:30');
    expect(parseImportTime('7:00 pm')).toBe('19:00');
  });

  it('maps the official Daniel game CSV format automatically', () => {
    const preview = buildScheduleImportRows({
      csv: 'Subject,Start Date,End Date,Start Time,End Time,,Home Team,Away Team,Location\n"(בית) Game &quot;A&quot;",08-10-2026,08-10-2026,7:00 pm,9:00 pm,,מ.ס. אבן יהודה,מכבי תל מונד הדס,"Court ""A"", Ralf"',
      mode: 'dated',
      defaultCategory: 'basketball',
    });

    expect(preview.mapping).toMatchObject({
      title: 'Subject',
      date: 'Start Date',
      startTime: 'Start Time',
      endTime: 'End Time',
      homeTeam: 'Home Team',
      awayTeam: 'Away Team',
      location: 'Location',
    });
    expect(preview.rows[0]).toMatchObject({
      date: '2026-10-08',
      startTime: '19:00',
      endTime: '21:00',
      title: '(בית) Game "A"',
      location: 'Court "A", Ralf',
      sourceKind: 'official_game_csv',
      status: 'ready',
    });
    expect(preview.rows[0]?.notes).toContain('קבוצת בית: מ.ס. אבן יהודה');
    expect(preview.rows[0]?.notes).toContain('קבוצת חוץ: מכבי תל מונד הדס');
  });

  it('imports official game rows as one-time events with official source metadata', () => {
    const preview = buildScheduleImportRows({
      csv: 'Subject,Start Date,Start Time,End Time,Home Team,Away Team,Location\nGame,08-10-2026,7:00 pm,9:00 pm,Home,Away,Court',
      mode: 'dated',
      defaultCategory: 'basketball',
    });
    const event = importRowToEvent({
      row: preview.rows[0]!,
      targetMemberId: 'daniel',
      defaultCategory: 'basketball',
      mode: 'dated',
      batchId: 'official-a',
      nowIso: '2026-09-22T00:00:00.000Z',
    });

    expect(event?.recurrence).toBeNull();
    expect(event?.date).toBe('2026-10-08');
    expect(event?.notes).toContain('import_source:official_game_csv');
    expect(isImportedFromSource(event!, 'official_game_csv')).toBe(true);
  });

  it('flags invalid date, invalid time, and missing title', () => {
    const preview = buildScheduleImportRows({
      csv: 'Date,Start,Title\n2026-31-03,99:99,',
      mode: 'dated',
      defaultCategory: 'basketball',
    });

    expect(preview.rows[0]?.status).toBe('invalid');
    expect(preview.rows[0]?.messages).toEqual(expect.arrayContaining(['Invalid date', 'Invalid time', 'Missing title']));
  });

  it('detects duplicates and leaves duplicate rows unselected by default', () => {
    const preview = buildScheduleImportRows({
      csv: 'Date,Start,Title\n2026-10-03,18:30,Training',
      mode: 'dated',
      targetMemberId: 'daniel',
      defaultCategory: 'basketball',
      existingEvents: [existingEvent],
    });

    expect(preview.rows[0]?.status).toBe('duplicate');
    expect(preview.rows[0]?.selected).toBe(false);
  });

  it('creates weekly recurring events from weekday rows', () => {
    const preview = buildScheduleImportRows({
      csv: 'Day,Start,Title\nTuesday,17:00,Practice',
      mode: 'weekly',
      defaultCategory: 'basketball',
      startDate: '2026-10-04',
      endDate: '2026-10-18',
    });
    const event = importRowToEvent({
      row: preview.rows[0]!,
      targetMemberId: 'daniel',
      defaultCategory: 'basketball',
      mode: 'weekly',
      startDate: '2026-10-04',
      endDate: '2026-10-18',
      batchId: 'batch-a',
      nowIso: '2026-09-22T00:00:00.000Z',
    });

    expect(event?.recurrence).toMatchObject({ frequency: 'weekly', daysOfWeek: [2] });
    expect(getOccurrencesForRange([event!], [], '2026-10-04', '2026-10-18')).toHaveLength(2);
  });

  it('imported one-time events appear through the schedule engine and remain editable event data', () => {
    const preview = buildScheduleImportRows({
      csv: 'Date,Start,Title\n2026-10-03,18:30,Training',
      mode: 'dated',
      defaultCategory: 'basketball',
    });
    const event = importRowToEvent({
      row: preview.rows[0]!,
      targetMemberId: 'daniel',
      defaultCategory: 'basketball',
      mode: 'dated',
      batchId: 'batch-a',
      nowIso: '2026-09-22T00:00:00.000Z',
    });

    expect(event?.recurrence).toBeNull();
    expect(event?.notes).toContain('csv_import:batch-a');
    expect(event?.participantIds).toEqual(['daniel']);
    expect(getOccurrencesForRange([event!], [], '2026-10-03', '2026-10-03')[0]?.title).toBe('Training');
  });

  it('rejects overly large CSV input', () => {
    expect(() => buildScheduleImportRows({
      csv: `Date,Start,Title\n${'x'.repeat(2 * 1024 * 1024)}`,
      mode: 'dated',
      defaultCategory: 'basketball',
    })).toThrow('CSV file is too large.');
  });

  it('keeps mixed valid and invalid rows in preview', () => {
    const preview = buildScheduleImportRows({
      csv: 'Date,Start,Title\n2026-10-03,18:30,Training\nbad,18:30,Training',
      mode: 'dated',
      defaultCategory: 'basketball',
    });

    expect(preview.rows.map((row) => row.status)).toEqual(['ready', 'invalid']);
  });
});
