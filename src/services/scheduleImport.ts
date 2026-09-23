import type { Event, EventCategory } from '../models';
import { getDayOfWeek, isValidDate, isValidTime } from '../utils/dateTime';

export type ScheduleImportMode = 'dated' | 'weekly';
export type ScheduleImportStatus = 'ready' | 'duplicate' | 'warning' | 'invalid';
export type ScheduleImportField = 'date' | 'day' | 'startTime' | 'endTime' | 'title' | 'location' | 'notes' | 'category' | 'homeTeam' | 'awayTeam';
export type ScheduleImportSourceKind = 'csv' | 'official_game_csv' | 'whatsapp_weekly';

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
}

export type ColumnMapping = Partial<Record<ScheduleImportField, string>>;

export interface ScheduleImportInputRow {
  sourceRow: number;
  date: string | null;
  weekday: number | null;
  startTime: string;
  endTime: string | null;
  title: string;
  location: string | null;
  notes: string | null;
  category: EventCategory | null;
  sourceKind?: ScheduleImportSourceKind;
  homeTeam?: string | null;
  awayTeam?: string | null;
  selected: boolean;
  status: ScheduleImportStatus;
  messages: string[];
}

export interface BuildImportRowsOptions {
  csv: string;
  mapping?: ColumnMapping;
  mode: ScheduleImportMode;
  targetMemberId?: string;
  defaultCategory: EventCategory;
  startDate?: string;
  endDate?: string | null;
  existingEvents?: Event[];
  sourceKind?: ScheduleImportSourceKind;
}

const importCategories: EventCategory[] = [
  'school',
  'basketball',
  'dance',
  'privateLesson',
  'scouts',
  'doctor',
  'dentist',
  'friends',
  'family',
  'work',
  'meal',
  'other',
];

const weekdayAliases = new Map<string, number>([
  ['sunday', 0], ['sun', 0], ['ראשון', 0], ['א', 0], ['א׳', 0],
  ['monday', 1], ['mon', 1], ['שני', 1], ['ב', 1], ['ב׳', 1],
  ['tuesday', 2], ['tue', 2], ['שלישי', 2], ['ג', 2], ['ג׳', 2],
  ['wednesday', 3], ['wed', 3], ['רביעי', 3], ['ד', 3], ['ד׳', 3],
  ['thursday', 4], ['thu', 4], ['חמישי', 4], ['ה', 4], ['ה׳', 4],
  ['friday', 5], ['fri', 5], ['שישי', 5], ['ו', 5], ['ו׳', 5],
  ['saturday', 6], ['sat', 6], ['שבת', 6], ['ש', 6], ['ש׳', 6],
]);

const categoryAliases: Record<string, EventCategory> = {
  school: 'school',
  'בית ספר': 'school',
  basketball: 'basketball',
  כדורסל: 'basketball',
  training: 'basketball',
  אימון: 'basketball',
  dance: 'dance',
  ריקוד: 'dance',
  doctor: 'doctor',
  רופא: 'doctor',
  scouts: 'scouts',
  צופים: 'scouts',
  friends: 'friends',
  חברים: 'friends',
  other: 'other',
  אחר: 'other',
};

export const maxScheduleImportCsvBytes = 2 * 1024 * 1024;
export const maxScheduleImportRows = 1000;

export function parseCsv(csv: string): CsvParseResult {
  const text = csv.replace(/^\uFEFF/u, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some((value) => value !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value !== '')) {
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows;

  return {
    headers: headers.map((header) => decodeSafeHtmlEntities(header)),
    rows: dataRows.map((dataRow) => dataRow.map((cell) => decodeSafeHtmlEntities(cell))),
  };
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  for (const header of headers) {
    const normalized = normalizeHeader(header);

    if (mapping.date === undefined && ['date', 'trainingdate', 'תאריך'].includes(normalized)) {
      mapping.date = header;
    } else if (mapping.day === undefined && ['day', 'weekday', 'יום'].includes(normalized)) {
      mapping.day = header;
    } else if (mapping.startTime === undefined && ['start', 'starttime', 'time', 'hour', 'שעה', 'שעתהתחלה'].includes(normalized)) {
      mapping.startTime = header;
    } else if (mapping.endTime === undefined && ['end', 'endtime', 'שעתסיום'].includes(normalized)) {
      mapping.endTime = header;
    } else if (mapping.title === undefined && ['title', 'event', 'activity', 'subject', 'כותרת', 'פעילות'].includes(normalized)) {
      mapping.title = header;
    } else if (mapping.location === undefined && ['location', 'place', 'מיקום', 'מקום'].includes(normalized)) {
      mapping.location = header;
    } else if (mapping.notes === undefined && ['notes', 'note', 'הערות', 'הערה'].includes(normalized)) {
      mapping.notes = header;
    } else if (mapping.category === undefined && ['category', 'type', 'activitytype', 'סוגפעילות', 'קטגוריה'].includes(normalized)) {
      mapping.category = header;
    }
  }

  return mapping;
}

export function buildScheduleImportRows(options: BuildImportRowsOptions): { headers: string[]; mapping: ColumnMapping; rows: ScheduleImportInputRow[] } {
  if (new TextEncoder().encode(options.csv).length > maxScheduleImportCsvBytes) {
    throw new Error('CSV file is too large.');
  }

  const parsed = parseCsv(options.csv);

  if (parsed.rows.length > maxScheduleImportRows) {
    throw new Error('CSV has too many rows.');
  }

  const mapping = { ...enhanceColumnMapping(parsed.headers, guessColumnMapping(parsed.headers)), ...options.mapping };
  const headerIndex = new Map(parsed.headers.map((header, index) => [header, index]));
  const rows = parsed.rows.map((rawRow, index) =>
    normalizeImportRow(rawRow, index + 2, headerIndex, mapping, options),
  );
  const existingKeys = new Set((options.existingEvents ?? []).map((event) => getDuplicateKeyFromEvent(event)));

  for (const row of rows) {
    const duplicateKey = options.targetMemberId === undefined
      ? getDuplicateKeyFromImportRow(row, options.defaultCategory)
      : getDuplicateKeyForTarget(row, options.targetMemberId, options.defaultCategory);

    if (row.status !== 'invalid' && duplicateKey !== null && existingKeys.has(duplicateKey)) {
      row.status = 'duplicate';
      row.selected = false;
      row.messages.push('A similar event already exists');
    }
  }

  return { headers: parsed.headers, mapping, rows };
}

export function importRowToEvent({
  row,
  targetMemberId,
  defaultCategory,
  mode,
  startDate,
  endDate,
  batchId,
  nowIso,
}: {
  row: ScheduleImportInputRow;
  targetMemberId: string;
  defaultCategory: EventCategory;
  mode: ScheduleImportMode;
  startDate?: string;
  endDate?: string | null;
  batchId: string;
  nowIso: string;
}): Event | null {
  if (row.status === 'invalid') {
    return null;
  }

  const category = row.category ?? defaultCategory;
  const sourceKind = row.sourceKind ?? 'csv';
  const base = {
    id: `schedule-import-${batchId}-${row.sourceRow}-${crypto.randomUUID()}`,
    childId: targetMemberId,
    participantIds: [targetMemberId],
    title: row.title,
    category,
    customCategoryLabel: null,
    startTime: row.startTime,
    endTime: row.endTime,
    endsNextDay: false,
    location: row.location,
    notes: withImportMetadata(row.notes, batchId, sourceKind),
    requiresTransportation: false,
    pickupTime: null,
    dropoffTime: null,
    status: 'scheduled' as const,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  if (mode === 'weekly') {
    if (row.weekday === null || startDate === undefined || !isValidDate(startDate)) {
      return null;
    }

    return {
      ...base,
      date: null,
      recurrence: {
        frequency: 'weekly',
        interval: 1,
        startDate,
        endDate: endDate ?? null,
        daysOfWeek: [row.weekday],
      },
    };
  }

  if (row.date === null) {
    return null;
  }

  return { ...base, date: row.date, recurrence: null };
}

export function getDuplicateKeyFromEvent(event: Event): string {
  const dateOrDay = event.recurrence?.frequency === 'weekly'
    ? `w:${event.recurrence.daysOfWeek?.join(',') ?? ''}`
    : `d:${event.date ?? ''}`;

  return [event.childId, dateOrDay, event.startTime, normalizeText(event.title), event.category].join('|');
}

export function getDuplicateKeyFromImportRow(row: ScheduleImportInputRow, defaultCategory: EventCategory): string | null {
  const category = row.category ?? defaultCategory;
  const dateOrDay = row.date !== null ? `d:${row.date}` : row.weekday !== null ? `w:${row.weekday}` : null;

  return dateOrDay === null || row.startTime === '' || row.title === ''
    ? null
    : ['', dateOrDay, row.startTime, normalizeText(row.title), category].join('|');
}

export function getDuplicateKeyForTarget(row: ScheduleImportInputRow, targetMemberId: string, defaultCategory: EventCategory): string | null {
  const baseKey = getDuplicateKeyFromImportRow(row, defaultCategory);

  return baseKey === null ? null : `${targetMemberId}${baseKey}`;
}

export function parseImportDate(value: string): string | null {
  const trimmed = value.trim();

  if (isValidDate(trimmed)) {
    return trimmed;
  }

  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u.exec(trimmed);
  const dotMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/u.exec(trimmed);
  const dashMatch = /^(\d{1,2})-(\d{1,2})-(\d{4})$/u.exec(trimmed);
  const match = slashMatch ?? dotMatch ?? dashMatch;

  if (match === null) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const formatted = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

  return isValidDate(formatted) ? formatted : null;
}

export function parseImportTime(value: string): string | null {
  const trimmed = value.trim();

  if (trimmed === '') {
    return null;
  }

  const withoutSeconds = /^(\d{1,2}):(\d{2})(?::\d{2})?$/u.exec(trimmed);

  if (withoutSeconds !== null) {
    const formatted = `${withoutSeconds[1].padStart(2, '0')}:${withoutSeconds[2]}`;
    return isValidTime(formatted) ? formatted : null;
  }

  const amPm = /^(\d{1,2}):(\d{2})\s*([AP]M)$/iu.exec(trimmed);

  if (amPm !== null) {
    let hour = Number(amPm[1]);
    const minute = amPm[2];
    const suffix = amPm[3].toUpperCase();

    if (hour < 1 || hour > 12) {
      return null;
    }

    if (suffix === 'PM' && hour !== 12) {
      hour += 12;
    }

    if (suffix === 'AM' && hour === 12) {
      hour = 0;
    }

    const formatted = `${hour.toString().padStart(2, '0')}:${minute}`;
    return isValidTime(formatted) ? formatted : null;
  }

  return null;
}

function normalizeImportRow(
  rawRow: string[],
  sourceRow: number,
  headerIndex: Map<string, number>,
  mapping: ColumnMapping,
  options: BuildImportRowsOptions,
): ScheduleImportInputRow {
  const messages: string[] = [];
  const rawDate = getMappedValue(rawRow, headerIndex, mapping.date);
  const rawDay = getMappedValue(rawRow, headerIndex, mapping.day);
  const rawStart = getMappedValue(rawRow, headerIndex, mapping.startTime);
  const rawEnd = getMappedValue(rawRow, headerIndex, mapping.endTime);
  const rawTitle = getMappedValue(rawRow, headerIndex, mapping.title);
  const rawHomeTeam = getMappedValue(rawRow, headerIndex, mapping.homeTeam);
  const rawAwayTeam = getMappedValue(rawRow, headerIndex, mapping.awayTeam);
  const rawCategory = getMappedValue(rawRow, headerIndex, mapping.category);
  const date = rawDate === '' ? null : parseImportDate(rawDate);
  const weekday = rawDay === '' ? (date === null ? null : getDayOfWeek(date)) : parseWeekday(rawDay);
  const startTime = parseImportTime(rawStart) ?? '';
  const endTime = rawEnd === '' ? null : parseImportTime(rawEnd);
  const title = rawTitle.trim();
  const category = rawCategory === '' ? null : parseImportCategory(rawCategory);
  const notes = buildRowNotes(getMappedValue(rawRow, headerIndex, mapping.notes), rawHomeTeam, rawAwayTeam);
  const sourceKind = options.sourceKind ?? inferSourceKind(headerIndex);
  let status: ScheduleImportStatus = 'ready';

  if (options.mode === 'dated' && date === null) {
    status = 'invalid';
    messages.push('Invalid date');
  }

  if (options.mode === 'weekly' && weekday === null) {
    status = 'invalid';
    messages.push('Invalid weekday');
  }

  if (startTime === '') {
    status = 'invalid';
    messages.push('Invalid time');
  }

  if (rawEnd !== '' && endTime === null) {
    status = 'invalid';
    messages.push('Invalid end time');
  }

  if (title === '') {
    status = 'invalid';
    messages.push('Missing title');
  }

  if (rawCategory !== '' && category === null) {
    status = status === 'invalid' ? status : 'warning';
    messages.push('Unknown category; default will be used');
  }

  return {
    sourceRow,
    date,
    weekday,
    startTime,
    endTime,
    title,
    location: getMappedValue(rawRow, headerIndex, mapping.location) || null,
    notes,
    category,
    sourceKind,
    homeTeam: rawHomeTeam || null,
    awayTeam: rawAwayTeam || null,
    selected: status !== 'invalid',
    status,
    messages,
  };
}

function getMappedValue(rawRow: string[], headerIndex: Map<string, number>, header: string | undefined): string {
  return header === undefined ? '' : rawRow[headerIndex.get(header) ?? -1]?.trim() ?? '';
}

export function withImportMetadata(notes: string | null, batchId: string, sourceKind: ScheduleImportSourceKind): string {
  const metadata = [`csv_import:${batchId}`, `import_source:${sourceKind}`];
  const userNotes = notes?.trim() ?? '';

  return userNotes === '' ? metadata.join('\n') : `${userNotes}\n${metadata.join('\n')}`;
}

export function isImportedFromSource(event: Event, sourceKind: ScheduleImportSourceKind): boolean {
  return event.notes?.includes(`import_source:${sourceKind}`) ?? false;
}

function enhanceColumnMapping(headers: string[], mapping: ColumnMapping): ColumnMapping {
  const enhanced = { ...mapping };

  for (const header of headers) {
    const normalized = normalizeHeader(header);

    if (enhanced.date === undefined && normalized === 'startdate') {
      enhanced.date = header;
    } else if (enhanced.homeTeam === undefined && normalized === 'hometeam') {
      enhanced.homeTeam = header;
    } else if (enhanced.awayTeam === undefined && normalized === 'awayteam') {
      enhanced.awayTeam = header;
    }
  }

  return enhanced;
}

function buildRowNotes(rawNotes: string, rawHomeTeam: string, rawAwayTeam: string): string | null {
  const parts = [
    rawNotes.trim(),
    rawHomeTeam.trim() === '' ? '' : `\u05e7\u05d1\u05d5\u05e6\u05ea \u05d1\u05d9\u05ea: ${rawHomeTeam.trim()}`,
    rawAwayTeam.trim() === '' ? '' : `\u05e7\u05d1\u05d5\u05e6\u05ea \u05d7\u05d5\u05e5: ${rawAwayTeam.trim()}`,
  ].filter((part) => part !== '');

  return parts.length === 0 ? null : parts.join('\n');
}

function inferSourceKind(headerIndex: Map<string, number>): ScheduleImportSourceKind {
  const headers = Array.from(headerIndex.keys()).map(normalizeHeader);

  return headers.includes('subject') && headers.includes('startdate') && headers.includes('hometeam') && headers.includes('awayteam')
    ? 'official_game_csv'
    : 'csv';
}

function decodeSafeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/giu, '"')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&#39;/giu, "'")
    .replace(/&apos;/giu, "'");
}

function parseWeekday(value: string): number | null {
  const normalized = value.trim().toLowerCase().replace(/["'״]/gu, '');
  const numeric = Number(normalized);

  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
    return numeric;
  }

  return weekdayAliases.get(normalized) ?? null;
}

function parseImportCategory(value: string): EventCategory | null {
  const normalized = normalizeText(value);

  if (importCategories.includes(normalized as EventCategory)) {
    return normalized as EventCategory;
  }

  return categoryAliases[normalized] ?? null;
}

function normalizeHeader(value: string): string {
  return normalizeText(value).replace(/\s+/gu, '');
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/["'״]/gu, '').replace(/\s+/gu, ' ');
}
