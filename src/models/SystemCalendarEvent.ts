import type { Language } from '../i18n/translations';

export type SystemCalendarSourceId = 'israel_holidays' | 'moe_school_vacations';
export type SystemCalendarEventType = 'holiday' | 'school_vacation';
export type EducationSector = 'jewish_official' | 'arab_official' | 'druze_official' | 'recognized_non_official';
export type SchoolLevel = 'kindergarten' | 'primary' | 'middle_school' | 'high_school';

export interface LocalizedText {
  he: string;
  en: string;
}

export interface EducationProfile {
  sector: EducationSector;
  level: SchoolLevel;
}

export interface SystemCalendarEvent {
  id: string;
  source: SystemCalendarSourceId;
  type: SystemCalendarEventType;
  title: LocalizedText;
  startDate: string;
  endDate: string;
  allDay: true;
  description: LocalizedText | null;
  sourceUrl: string | null;
  sourceReference: string | null;
  appliesToAllParticipants: boolean;
  participantIds: string[];
  metadata: {
    calendarYear?: string;
    schoolYear?: string;
    profile?: EducationProfile;
    sourceName: LocalizedText;
    lastVerifiedAt: string;
    israelMode?: boolean;
    minor?: boolean;
    readOnly: true;
  };
}

export interface IsraelHolidaySourceConfig {
  enabled: boolean;
  includeMinorObservances: boolean;
}

export interface MinistryEducationSourceConfig {
  enabled: boolean;
  schoolYear: string;
  profile: EducationProfile;
  studentParticipantIds: string[];
}

export interface CalendarSourceSettings {
  israel_holidays: IsraelHolidaySourceConfig;
  moe_school_vacations: MinistryEducationSourceConfig;
  updatedAt: string | null;
}

export function getLocalizedText(text: LocalizedText, language: Language): string {
  return text[language];
}
