import type { EventCategory } from '../models';
import { addDays, getDayOfWeek, isValidDate } from '../utils/dateTime';
import { parseImportTime, type ScheduleImportInputRow } from './scheduleImport';

export interface WeeklyScheduleTextParseOptions {
  text: string;
  targetWeekStart: string;
  defaultCategory: EventCategory;
}

const hebrewWeekdays: Array<{ label: string; weekday: number }> = [
  { label: '\u05e8\u05d0\u05e9\u05d5\u05df', weekday: 0 },
  { label: '\u05e9\u05e0\u05d9', weekday: 1 },
  { label: '\u05e9\u05dc\u05d9\u05e9\u05d9', weekday: 2 },
  { label: '\u05e8\u05d1\u05d9\u05e2\u05d9', weekday: 3 },
  { label: '\u05d7\u05de\u05d9\u05e9\u05d9', weekday: 4 },
  { label: '\u05e9\u05d9\u05e9\u05d9', weekday: 5 },
  { label: '\u05e9\u05d1\u05ea', weekday: 6 },
];

const dayPrefix = '\u05d9\u05d5\u05dd ';
const basketballTrainingTitle = '\u05d0\u05d9\u05de\u05d5\u05df \u05db\u05d3\u05d5\u05e8\u05e1\u05dc';
const practiceGameTitle = '\u05de\u05e9\u05d7\u05e7 \u05d0\u05d9\u05de\u05d5\u05df';
const ralfLocation = '\u05e8\u05dc\u05e3';
const athleticsTitle = '\u05d0\u05ea\u05dc\u05d8\u05d9\u05e7\u05d4';
const hodHasharon = '\u05d4\u05d5\u05d3 \u05d4\u05e9\u05e8\u05d5\u05df';
const rideTimeNote = '\u05d0\u05e2\u05d3\u05db\u05df \u05e9\u05e2\u05ea \u05d4\u05e1\u05e2\u05d4';

export function getSundayOfWeek(date: string): string {
  if (!isValidDate(date)) {
    throw new Error(`Invalid date: ${date}`);
  }

  return addDays(date, -getDayOfWeek(date));
}

export function getWeekDate(targetWeekStart: string, weekday: number): string {
  if (!isValidDate(targetWeekStart)) {
    throw new Error(`Invalid target week: ${targetWeekStart}`);
  }

  return addDays(targetWeekStart, weekday);
}

export function parseWeeklyScheduleText({
  text,
  targetWeekStart,
  defaultCategory,
}: WeeklyScheduleTextParseOptions): ScheduleImportInputRow[] {
  const weekStart = getSundayOfWeek(targetWeekStart);
  const rows: ScheduleImportInputRow[] = [];
  let currentWeekday: number | null = null;

  text.split(/\r?\n/u).forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed === '\u05dc\u05d5\u05d6' || trimmed === '\u05dc\u05d5\u05f4\u05d6') {
      return;
    }

    const parsedPrefix = parseLinePrefix(trimmed);
    const weekday = parsedPrefix.weekday ?? (parsedPrefix.hasTime ? currentWeekday : null);
    const messages: string[] = [];
    let status: ScheduleImportInputRow['status'] = 'ready';

    if (parsedPrefix.weekday !== null) {
      currentWeekday = parsedPrefix.weekday;
    }

    if (weekday === null) {
      status = 'invalid';
      messages.push('Invalid weekday');
    }

    if (parsedPrefix.time === null) {
      status = 'invalid';
      messages.push('Time required');
    }

    const interpreted = interpretDescription(parsedPrefix.description);

    if (interpreted.title === '') {
      status = 'invalid';
      messages.push('Missing title');
    }

    rows.push({
      sourceRow: index + 1,
      date: weekday === null ? null : getWeekDate(weekStart, weekday),
      weekday,
      startTime: parsedPrefix.time ?? '',
      endTime: null,
      title: interpreted.title,
      location: interpreted.location,
      notes: interpreted.notes,
      category: defaultCategory,
      sourceKind: 'whatsapp_weekly',
      selected: status !== 'invalid',
      status,
      messages,
    });
  });

  return rows;
}

function parseLinePrefix(line: string): { weekday: number | null; time: string | null; description: string; hasTime: boolean } {
  let remaining = line;
  let weekday: number | null = null;

  for (const candidate of hebrewWeekdays) {
    if (remaining.startsWith(candidate.label)) {
      weekday = candidate.weekday;
      remaining = remaining.slice(candidate.label.length).trim();
      break;
    }

    const prefixedLabel = `${dayPrefix}${candidate.label}`;

    if (remaining.startsWith(prefixedLabel)) {
      weekday = candidate.weekday;
      remaining = remaining.slice(prefixedLabel.length).trim();
      break;
    }
  }

  const timeMatch = /^(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]m)?)\b/iu.exec(remaining);
  const time = timeMatch === null ? null : parseImportTime(timeMatch[1]);

  if (timeMatch !== null) {
    remaining = remaining.slice(timeMatch[0].length).trim();
  }

  return { weekday, time, description: remaining, hasTime: timeMatch !== null };
}

function interpretDescription(description: string): { title: string; location: string | null; notes: string | null } {
  const text = description.trim();

  if (text.includes(ralfLocation)) {
    return { title: basketballTrainingTitle, location: ralfLocation, notes: null };
  }

  if (text.includes(athleticsTitle)) {
    return { title: athleticsTitle, location: null, notes: null };
  }

  if (text.includes(practiceGameTitle)) {
    return {
      title: practiceGameTitle,
      location: text.includes(hodHasharon) ? hodHasharon : null,
      notes: text.includes(rideTimeNote) ? rideTimeNote : null,
    };
  }

  return { title: text === '' ? basketballTrainingTitle : text, location: null, notes: null };
}
