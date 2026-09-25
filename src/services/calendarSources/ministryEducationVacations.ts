import type { EducationProfile, SystemCalendarEvent } from '../../models';
import { toPlainText } from './plainText';

interface VacationRecord {
  id: string;
  title: { he: string; en: string };
  startDate: string;
  endDate: string;
  profile: EducationProfile;
  schoolYear: string;
  sourceReference: string;
}

export interface MinistryEducationProviderOptions {
  startDate: string;
  endDate: string;
  schoolYear: string;
  profile: EducationProfile;
  studentParticipantIds: string[];
}

export const ministryEducationSourceUrl = 'https://pop.education.gov.il/maagal_hashana/vacation-schedule/';
export const ministryEducationLastVerifiedAt = '2026-09-02';

const vacations: VacationRecord[] = [
  {
    id: 'rosh-hashana-break-2026',
    title: { he: 'חופשת ראש השנה', en: 'Rosh Hashana vacation' },
    startDate: '2026-09-11',
    endDate: '2026-09-13',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'yom-kippur-to-sukkot-break-2026',
    title: { he: 'חופשת יום כיפור וסוכות', en: 'Yom Kippur and Sukkot vacation' },
    startDate: '2026-09-20',
    endDate: '2026-10-03',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'hanukkah-break-2026',
    title: { he: 'חופשת חנוכה', en: 'Hanukkah vacation' },
    startDate: '2026-12-06',
    endDate: '2026-12-12',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'purim-break-2027',
    title: { he: 'חופשת פורים', en: 'Purim vacation' },
    startDate: '2027-03-23',
    endDate: '2027-03-24',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'pesach-break-2027',
    title: { he: 'חופשת פסח', en: 'Pesach vacation' },
    startDate: '2027-04-13',
    endDate: '2027-04-28',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'independence-day-break-2027',
    title: { he: 'יום העצמאות - אין לימודים', en: 'Independence Day - no school' },
    startDate: '2027-05-12',
    endDate: '2027-05-12',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'shavuot-break-2027',
    title: { he: 'חופשת שבועות', en: 'Shavuot vacation' },
    startDate: '2027-06-10',
    endDate: '2027-06-11',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
  {
    id: 'summer-break-2027',
    title: { he: 'החופש הגדול', en: 'Summer vacation' },
    startDate: '2027-06-21',
    endDate: '2027-08-31',
    schoolYear: '2026-2027',
    profile: { sector: 'jewish_official', level: 'middle_school' },
    sourceReference: 'Ministry of Education circular 0363, Jewish official education, middle school',
  },
];

export function getMinistryEducationVacationEvents({
  startDate,
  endDate,
  schoolYear,
  profile,
  studentParticipantIds,
}: MinistryEducationProviderOptions): SystemCalendarEvent[] {
  if (studentParticipantIds.length === 0) {
    return [];
  }

  return vacations
    .filter((vacation) => vacation.schoolYear === schoolYear)
    .filter((vacation) => isSameProfile(vacation.profile, profile))
    .filter((vacation) => rangesOverlap(vacation.startDate, vacation.endDate, startDate, endDate))
    .map((vacation) => ({
      id: `moe_school_vacations:${vacation.id}`,
      source: 'moe_school_vacations',
      type: 'school_vacation',
      title: localizePlain(vacation.title),
      startDate: vacation.startDate,
      endDate: vacation.endDate,
      allDay: true,
      description: {
        he: 'חופשה רשמית לפי פרופיל משרד החינוך שהוגדר ללוח המשפחתי.',
        en: 'Official vacation for the configured Ministry of Education profile.',
      },
      sourceUrl: ministryEducationSourceUrl,
      sourceReference: vacation.sourceReference,
      appliesToAllParticipants: false,
      participantIds: Array.from(new Set(studentParticipantIds)),
      metadata: {
        schoolYear,
        profile,
        sourceName: { he: 'משרד החינוך', en: 'Ministry of Education' },
        lastVerifiedAt: ministryEducationLastVerifiedAt,
        readOnly: true,
      },
    }));
}

function isSameProfile(first: EducationProfile, second: EducationProfile): boolean {
  return first.sector === second.sector && first.level === second.level;
}

function rangesOverlap(firstStart: string, firstEnd: string, secondStart: string, secondEnd: string): boolean {
  return firstStart <= secondEnd && firstEnd >= secondStart;
}

function localizePlain(text: { he: string; en: string }) {
  return {
    he: toPlainText(text.he),
    en: toPlainText(text.en),
  };
}
