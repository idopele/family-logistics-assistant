import type { SystemCalendarEvent } from '../../models';
import { toPlainText } from './plainText';

interface HolidayRecord {
  id: string;
  title: { he: string; en: string };
  date: string;
  description: { he: string; en: string } | null;
  sourceReference: string;
  minor?: boolean;
}

export interface IsraelHolidayProviderOptions {
  startDate: string;
  endDate: string;
  includeMinorObservances: boolean;
}

export const hebcalIsraelSourceUrl = 'https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&mod=on&i=on';

const holidays: HolidayRecord[] = [
  {
    id: 'rosh-hashana-5787',
    title: { he: 'ראש השנה', en: 'Rosh Hashana' },
    date: '2026-09-12',
    description: { he: 'חג ראש השנה לפי לוח ישראל.', en: 'Rosh Hashana in the Israel holiday calendar.' },
    sourceReference: 'Hebcal Israel i=on, 1 Tishrei 5787',
  },
  {
    id: 'yom-kippur-5787',
    title: { he: 'יום כיפור', en: 'Yom Kippur' },
    date: '2026-09-21',
    description: { he: 'יום הכיפורים לפי לוח ישראל.', en: 'Yom Kippur in the Israel holiday calendar.' },
    sourceReference: 'Hebcal Israel i=on, 10 Tishrei 5787',
  },
  {
    id: 'sukkot-5787',
    title: { he: 'סוכות', en: 'Sukkot' },
    date: '2026-09-26',
    description: { he: 'חג סוכות, מיוצג כיום אזרחי מלא.', en: 'Sukkot represented as an all-day civil-date event.' },
    sourceReference: 'Hebcal Israel i=on, 15 Tishrei 5787',
  },
  {
    id: 'simchat-torah-5787',
    title: { he: 'שמחת תורה', en: 'Simchat Torah' },
    date: '2026-10-03',
    description: { he: 'שמיני עצרת/שמחת תורה בישראל ביום אחד.', en: 'Shmini Atzeret/Simchat Torah is one day in Israel.' },
    sourceReference: 'Hebcal Israel i=on, 22 Tishrei 5787',
  },
  {
    id: 'hanukkah-5787',
    title: { he: 'חנוכה', en: 'Hanukkah' },
    date: '2026-12-05',
    description: { he: 'תחילת חנוכה לפי לוח ישראל.', en: 'Start of Hanukkah in the Israel calendar.' },
    sourceReference: 'Hebcal Israel i=on, 25 Kislev 5787',
  },
  {
    id: 'purim-5787',
    title: { he: 'פורים', en: 'Purim' },
    date: '2027-03-23',
    description: { he: 'פורים.', en: 'Purim.' },
    sourceReference: 'Hebcal Israel i=on, 14 Adar II 5787',
  },
  {
    id: 'pesach-5787',
    title: { he: 'פסח', en: 'Pesach' },
    date: '2027-04-22',
    description: { he: 'חג הפסח לפי לוח ישראל.', en: 'Pesach in the Israel holiday calendar.' },
    sourceReference: 'Hebcal Israel i=on, 15 Nisan 5787',
  },
  {
    id: 'yom-hashoah-5787',
    title: { he: 'יום השואה', en: 'Yom HaShoah' },
    date: '2027-05-04',
    description: { he: 'יום הזיכרון לשואה ולגבורה.', en: 'Holocaust Remembrance Day.' },
    sourceReference: 'Hebcal Israel i=on modern holidays',
  },
  {
    id: 'yom-hazikaron-5787',
    title: { he: 'יום הזיכרון', en: 'Yom HaZikaron' },
    date: '2027-05-11',
    description: { he: 'יום הזיכרון לחללי מערכות ישראל.', en: "Israel's Memorial Day." },
    sourceReference: 'Hebcal Israel i=on modern holidays',
  },
  {
    id: 'yom-haatzmaut-5787',
    title: { he: 'יום העצמאות', en: "Yom HaAtzma'ut" },
    date: '2027-05-12',
    description: { he: 'יום העצמאות של מדינת ישראל.', en: "Israel's Independence Day." },
    sourceReference: 'Hebcal Israel i=on modern holidays',
  },
  {
    id: 'yom-yerushalayim-5787',
    title: { he: 'יום ירושלים', en: 'Yom Yerushalayim' },
    date: '2027-06-04',
    description: { he: 'יום ירושלים.', en: 'Jerusalem Day.' },
    sourceReference: 'Hebcal Israel i=on modern holidays',
  },
  {
    id: 'shavuot-5787',
    title: { he: 'שבועות', en: 'Shavuot' },
    date: '2027-06-11',
    description: { he: 'שבועות. בישראל אין יום טוב שני של גלויות.', en: 'Shavuot. Israel mode excludes the Diaspora second day.' },
    sourceReference: 'Hebcal Israel i=on, 6 Sivan 5787',
  },
  {
    id: 'tu-bishvat-5787',
    title: { he: 'ט״ו בשבט', en: 'Tu BiShvat' },
    date: '2027-01-23',
    description: { he: 'מועד משני, מוסתר כברירת מחדל.', en: 'Minor observance, hidden by default.' },
    sourceReference: 'Hebcal Israel i=on minor holidays',
    minor: true,
  },
];

export function getIsraelHolidayEvents({
  startDate,
  endDate,
  includeMinorObservances,
}: IsraelHolidayProviderOptions): SystemCalendarEvent[] {
  return holidays
    .filter((holiday) => includeMinorObservances || holiday.minor !== true)
    .filter((holiday) => holiday.date >= startDate && holiday.date <= endDate)
    .map((holiday) => ({
      id: `israel_holidays:${holiday.id}`,
      source: 'israel_holidays',
      type: 'holiday',
      title: localizePlain(holiday.title),
      startDate: holiday.date,
      endDate: holiday.date,
      allDay: true,
      description: holiday.description === null ? null : localizePlain(holiday.description),
      sourceUrl: hebcalIsraelSourceUrl,
      sourceReference: holiday.sourceReference,
      appliesToAllParticipants: true,
      participantIds: [],
      metadata: {
        calendarYear: `${holiday.date.slice(0, 4)}`,
        sourceName: { he: 'Hebcal', en: 'Hebcal' },
        lastVerifiedAt: '2026-09-23',
        israelMode: true,
        minor: holiday.minor === true,
        readOnly: true,
      },
    }));
}

function localizePlain(text: { he: string; en: string }) {
  return {
    he: toPlainText(text.he),
    en: toPlainText(text.en),
  };
}
