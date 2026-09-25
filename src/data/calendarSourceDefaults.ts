import type { CalendarSourceSettings } from '../models';

export const defaultCalendarSourceSettings: CalendarSourceSettings = {
  israel_holidays: {
    enabled: true,
    includeMinorObservances: false,
  },
  moe_school_vacations: {
    enabled: true,
    schoolYear: '2026-2027',
    profile: {
      sector: 'jewish_official',
      level: 'middle_school',
    },
    studentParticipantIds: ['daniel', 'emanuel'],
  },
  updatedAt: null,
};
