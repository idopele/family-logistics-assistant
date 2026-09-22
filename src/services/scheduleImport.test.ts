import { describe, expect, it } from 'vitest';
import { getOccurrencesForRange } from './scheduleEngine';
import {
  buildScheduleImportRows,
  importRowToEvent,
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
    expect(parseImportTime('18:30:00')).toBe('18:30');
    expect(parseImportTime('6:30 PM')).toBe('18:30');
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
