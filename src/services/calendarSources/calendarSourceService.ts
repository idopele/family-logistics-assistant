import { defaultCalendarSourceSettings } from '../../data/calendarSourceDefaults';
import type { CalendarSourceSettings, SystemCalendarEvent, SystemCalendarEventType } from '../../models';
import { isValidDate } from '../../utils/dateTime';
import { getIsraelHolidayEvents } from './israelHolidays';
import { getMinistryEducationVacationEvents } from './ministryEducationVacations';

export type SystemCalendarFilter = SystemCalendarEventType;

export const systemCalendarFilterValues: SystemCalendarFilter[] = ['holiday', 'school_vacation'];

export function getDefaultCalendarSourceSettings(): CalendarSourceSettings {
  return cloneSettings(defaultCalendarSourceSettings);
}

export function normalizeCalendarSourceSettings(value: unknown): CalendarSourceSettings {
  if (typeof value !== 'object' || value === null) {
    return getDefaultCalendarSourceSettings();
  }

  const candidate = value as Partial<CalendarSourceSettings>;
  const defaults = getDefaultCalendarSourceSettings();

  return {
    israel_holidays: {
      enabled: typeof candidate.israel_holidays?.enabled === 'boolean'
        ? candidate.israel_holidays.enabled
        : defaults.israel_holidays.enabled,
      includeMinorObservances: typeof candidate.israel_holidays?.includeMinorObservances === 'boolean'
        ? candidate.israel_holidays.includeMinorObservances
        : defaults.israel_holidays.includeMinorObservances,
    },
    moe_school_vacations: {
      enabled: typeof candidate.moe_school_vacations?.enabled === 'boolean'
        ? candidate.moe_school_vacations.enabled
        : defaults.moe_school_vacations.enabled,
      schoolYear: typeof candidate.moe_school_vacations?.schoolYear === 'string' && candidate.moe_school_vacations.schoolYear.trim() !== ''
        ? candidate.moe_school_vacations.schoolYear
        : defaults.moe_school_vacations.schoolYear,
      profile: {
        sector: isEducationSector(candidate.moe_school_vacations?.profile?.sector)
          ? candidate.moe_school_vacations.profile.sector
          : defaults.moe_school_vacations.profile.sector,
        level: isSchoolLevel(candidate.moe_school_vacations?.profile?.level)
          ? candidate.moe_school_vacations.profile.level
          : defaults.moe_school_vacations.profile.level,
      },
      studentParticipantIds: Array.isArray(candidate.moe_school_vacations?.studentParticipantIds)
        ? Array.from(new Set(candidate.moe_school_vacations.studentParticipantIds.filter((id) => typeof id === 'string' && id.trim() !== '')))
        : defaults.moe_school_vacations.studentParticipantIds,
    },
    updatedAt: typeof candidate.updatedAt === 'string' || candidate.updatedAt === null ? candidate.updatedAt : defaults.updatedAt,
  };
}

export function getSystemCalendarEventsForRange({
  settings,
  startDate,
  endDate,
  visibleParticipantIds,
}: {
  settings: CalendarSourceSettings;
  startDate: string;
  endDate: string;
  visibleParticipantIds: string[];
}): SystemCalendarEvent[] {
  if (!isValidDate(startDate) || !isValidDate(endDate) || endDate < startDate) {
    throw new Error('Invalid system calendar range');
  }

  const events: SystemCalendarEvent[] = [];

  if (settings.israel_holidays.enabled) {
    events.push(
      ...safeResolve(() =>
        getIsraelHolidayEvents({
          startDate,
          endDate,
          includeMinorObservances: settings.israel_holidays.includeMinorObservances,
        }),
      ),
    );
  }

  if (settings.moe_school_vacations.enabled) {
    const visibleStudents = settings.moe_school_vacations.studentParticipantIds.filter((participantId) =>
      visibleParticipantIds.includes(participantId),
    );

    events.push(
      ...safeResolve(() =>
        getMinistryEducationVacationEvents({
          startDate,
          endDate,
          schoolYear: settings.moe_school_vacations.schoolYear,
          profile: settings.moe_school_vacations.profile,
          studentParticipantIds: visibleStudents,
        }),
      ),
    );
  }

  return events.sort(compareSystemCalendarEvents);
}

export function filterSystemCalendarEventsForDashboard({
  events,
  selectedMemberIds,
  selectedTypes,
  selectedDates,
}: {
  events: SystemCalendarEvent[];
  selectedMemberIds: string[];
  selectedTypes: SystemCalendarEventType[];
  selectedDates: string[];
}): SystemCalendarEvent[] {
  return events.filter((event) => {
    const matchesType = selectedTypes.includes(event.type);
    const matchesMember = event.appliesToAllParticipants || event.participantIds.some((participantId) => selectedMemberIds.includes(participantId));
    const matchesDate = selectedDates.some((date) => date >= event.startDate && date <= event.endDate);

    return matchesType && matchesMember && matchesDate;
  });
}

export function getSystemEventsForDate(events: SystemCalendarEvent[], date: string): SystemCalendarEvent[] {
  return events.filter((event) => date >= event.startDate && date <= event.endDate).sort(compareSystemCalendarEvents);
}

export function compareSystemCalendarEvents(first: SystemCalendarEvent, second: SystemCalendarEvent): number {
  return (
    first.startDate.localeCompare(second.startDate) ||
    first.endDate.localeCompare(second.endDate) ||
    first.source.localeCompare(second.source) ||
    first.id.localeCompare(second.id)
  );
}

function safeResolve(resolve: () => SystemCalendarEvent[]): SystemCalendarEvent[] {
  try {
    return resolve();
  } catch {
    return [];
  }
}

function isEducationSector(value: unknown): value is CalendarSourceSettings['moe_school_vacations']['profile']['sector'] {
  return value === 'jewish_official' || value === 'arab_official' || value === 'druze_official' || value === 'recognized_non_official';
}

function isSchoolLevel(value: unknown): value is CalendarSourceSettings['moe_school_vacations']['profile']['level'] {
  return value === 'kindergarten' || value === 'primary' || value === 'middle_school' || value === 'high_school';
}

function cloneSettings(settings: CalendarSourceSettings): CalendarSourceSettings {
  return {
    israel_holidays: { ...settings.israel_holidays },
    moe_school_vacations: {
      ...settings.moe_school_vacations,
      profile: { ...settings.moe_school_vacations.profile },
      studentParticipantIds: [...settings.moe_school_vacations.studentParticipantIds],
    },
    updatedAt: settings.updatedAt,
  };
}
