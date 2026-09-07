import type {
  Child,
  Event,
  EventException,
  ScheduleOccurrence,
  TransportationConflict,
  TransportationLeg,
  TransportationPlan,
} from '../models';
import { getEventCategoryLabel } from '../data/eventCategories';
import { addDays, getDayOfWeek } from '../utils/dateTime';
import { formatDisplayDate, weekDayLabels } from '../utils/week';
import { getOccurrencesForDate, getOccurrencesForRange } from './scheduleEngine';
import { detectTransportationConflicts, getTransportationLegEffectiveDate } from './transportationConflictDetection';

export type OccurrenceTimingStatus = 'upcoming' | 'inProgress' | 'passed';

export interface ChildTodaySummaryData {
  child: Child;
  nextOccurrence: ScheduleOccurrence | null;
  hasNonSchoolOccurrencesToday: boolean;
  schoolLessonCount: number;
}

export interface TodayTransportationLeg {
  id: string;
  eventId: string;
  occurrenceDate: string;
  effectiveDate: string;
  direction: 'outbound' | 'returnTrip';
  driverName: string;
  time: string;
  passengerNames: string[];
  eventTitle: string;
}

export interface TodayCancellation {
  id: string;
  childName: string;
  title: string;
  time: string;
  date: string;
}

export interface FamilyActionCenterData {
  today: string;
  todayLabel: string;
  childSummaries: ChildTodaySummaryData[];
  remainingNonSchoolOccurrences: ScheduleOccurrence[];
  changedOccurrences: ScheduleOccurrence[];
  cancellations: TodayCancellation[];
  transportationLegs: TodayTransportationLeg[];
  transportationConflicts: TransportationConflict[];
  counts: {
    activities: number;
    transportationLegs: number;
    changes: number;
  };
}

export function buildFamilyActionCenterData({
  events,
  exceptions,
  transportationPlans,
  children,
  today,
  currentTime,
}: {
  events: Event[];
  exceptions: EventException[];
  transportationPlans: TransportationPlan[];
  children: Child[];
  today: string;
  currentTime: string;
}): FamilyActionCenterData {
  const todayOccurrences = getOccurrencesForDate(events, exceptions, today);
  const overnightLookupOccurrences = getOccurrencesForRange(events, exceptions, addDays(today, -1), today);
  const childNamesById = new Map(children.map((child) => [child.id, child.name]));
  const remainingNonSchoolOccurrences = getRemainingNonSchoolOccurrences(overnightLookupOccurrences, today, currentTime);
  const transportationLegs = getTodayTransportationLegs(transportationPlans, overnightLookupOccurrences, childNamesById, today);
  const transportationConflicts = detectTransportationConflicts(
    transportationPlans,
    overnightLookupOccurrences,
    children,
    today,
    today,
  );
  const cancellations = getTodayCancellations(events, exceptions, children, today);
  const changedOccurrences = todayOccurrences.filter((occurrence) => occurrence.isException);

  return {
    today,
    todayLabel: formatFullDisplayDate(today),
    childSummaries: getChildSummaries(children, todayOccurrences, remainingNonSchoolOccurrences),
    remainingNonSchoolOccurrences,
    changedOccurrences,
    cancellations,
    transportationLegs,
    transportationConflicts,
    counts: {
      activities: remainingNonSchoolOccurrences.length,
      transportationLegs: transportationLegs.length,
      changes: changedOccurrences.length + cancellations.length,
    },
  };
}

export function getRemainingNonSchoolOccurrences(
  occurrences: ScheduleOccurrence[],
  today: string,
  currentTime: string,
): ScheduleOccurrence[] {
  return occurrences
    .filter((occurrence) => occurrence.category !== 'school')
    .filter((occurrence) => getOccurrenceTimingStatus(occurrence, today, currentTime) !== 'passed')
    .sort(compareOccurrencesByTime);
}

export function getNextOccurrenceForChild(
  occurrences: ScheduleOccurrence[],
  childId: string,
  today: string,
  currentTime: string,
): ScheduleOccurrence | null {
  return (
    getRemainingNonSchoolOccurrences(
      occurrences.filter((occurrence) => occurrence.childId === childId),
      today,
      currentTime,
    )[0] ?? null
  );
}

export function getOccurrenceTimingStatus(
  occurrence: ScheduleOccurrence,
  today: string,
  currentTime: string,
): OccurrenceTimingStatus {
  const startDateTime = toComparableDateTime(occurrence.date, occurrence.startTime);
  const endDateTime =
    occurrence.endTime === null
      ? null
      : toComparableDateTime(occurrence.endsNextDay ? addDays(occurrence.date, 1) : occurrence.date, occurrence.endTime);
  const currentDateTime = toComparableDateTime(today, currentTime);

  if (endDateTime !== null && currentDateTime >= startDateTime && currentDateTime <= endDateTime) {
    return 'inProgress';
  }

  if (currentDateTime < startDateTime) {
    return 'upcoming';
  }

  return 'passed';
}

export function getTodayTransportationLegs(
  plans: TransportationPlan[],
  occurrences: ScheduleOccurrence[],
  childNamesById: Map<string, string>,
  today: string,
): TodayTransportationLeg[] {
  const occurrenceByKey = new Map(occurrences.map((occurrence) => [getOccurrenceKey(occurrence.eventId, occurrence.date), occurrence]));

  return plans
    .flatMap((plan) => {
      const occurrence = occurrenceByKey.get(getOccurrenceKey(plan.eventId, plan.occurrenceDate));

      if (occurrence === undefined) {
        return [];
      }

      return [
        plan.outbound === null ? null : toTodayTransportationLeg(plan, plan.outbound, 'outbound', occurrence, childNamesById),
        plan.returnTrip === null ? null : toTodayTransportationLeg(plan, plan.returnTrip, 'returnTrip', occurrence, childNamesById),
      ];
    })
    .filter((leg): leg is TodayTransportationLeg => leg !== null && leg.effectiveDate === today)
    .sort((first, second) => first.time.localeCompare(second.time) || first.id.localeCompare(second.id));
}

export function getTodayCancellations(
  events: Event[],
  exceptions: EventException[],
  children: Child[],
  today: string,
): TodayCancellation[] {
  const childNamesById = new Map(children.map((child) => [child.id, child.name]));

  return exceptions
    .filter((exception) => exception.type === 'cancelled' && exception.date === today)
    .flatMap((exception) => {
      const originalOccurrence = getOriginalOccurrenceForCancelledException(events, exceptions, exception);

      if (originalOccurrence === null) {
        return [];
      }

      return [
        {
          id: exception.id,
          childName: childNamesById.get(originalOccurrence.childId) ?? originalOccurrence.childId,
          title: originalOccurrence.title,
          time: originalOccurrence.startTime,
          date: originalOccurrence.date,
        },
      ];
    })
    .sort((first, second) => first.time.localeCompare(second.time) || first.title.localeCompare(second.title));
}

export function formatActionCenterTime(occurrence: ScheduleOccurrence): string {
  return occurrence.endTime === null ? occurrence.startTime : `${occurrence.startTime}-${occurrence.endTime}`;
}

export function formatActionCenterCategory(occurrence: ScheduleOccurrence): string {
  return getEventCategoryLabel(occurrence);
}

function getChildSummaries(
  children: Child[],
  todayOccurrences: ScheduleOccurrence[],
  remainingNonSchoolOccurrences: ScheduleOccurrence[],
): ChildTodaySummaryData[] {
  return children.map((child) => {
    const childOccurrences = todayOccurrences.filter((occurrence) => occurrence.childId === child.id);

    return {
      child,
      nextOccurrence: remainingNonSchoolOccurrences.find((occurrence) => occurrence.childId === child.id) ?? null,
      hasNonSchoolOccurrencesToday: childOccurrences.some((occurrence) => occurrence.category !== 'school'),
      schoolLessonCount: childOccurrences.filter((occurrence) => occurrence.category === 'school').length,
    };
  });
}

function getOriginalOccurrenceForCancelledException(
  events: Event[],
  exceptions: EventException[],
  cancelledException: EventException,
): ScheduleOccurrence | null {
  const exceptionsWithoutCancellation = exceptions.filter(
    (exception) => exception.eventId !== cancelledException.eventId || exception.date !== cancelledException.date,
  );

  return (
    getOccurrencesForDate(events, exceptionsWithoutCancellation, cancelledException.date).find(
      (occurrence) => occurrence.eventId === cancelledException.eventId,
    ) ?? null
  );
}

function toTodayTransportationLeg(
  plan: TransportationPlan,
  leg: TransportationLeg,
  direction: 'outbound' | 'returnTrip',
  occurrence: ScheduleOccurrence,
  childNamesById: Map<string, string>,
): TodayTransportationLeg {
  return {
    id: `${plan.id}-${direction}`,
    eventId: plan.eventId,
    occurrenceDate: plan.occurrenceDate,
    effectiveDate: getTransportationLegEffectiveDate(plan, leg),
    direction,
    driverName: leg.driverName,
    time: leg.time,
    passengerNames: leg.passengerChildIds.map((childId) => childNamesById.get(childId) ?? childId),
    eventTitle: occurrence.title,
  };
}

function formatFullDisplayDate(date: string): string {
  const { year } = { year: date.slice(0, 4) };
  const dayLabel = weekDayLabels[getDayOfWeek(date)];

  return `יום ${dayLabel} · ${formatDisplayDate(date)}.${year}`;
}

function compareOccurrencesByTime(first: ScheduleOccurrence, second: ScheduleOccurrence): number {
  return first.startTime.localeCompare(second.startTime) || first.childId.localeCompare(second.childId) || first.eventId.localeCompare(second.eventId);
}

function toComparableDateTime(date: string, time: string): string {
  return `${date}T${time}`;
}

function getOccurrenceKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}|${occurrenceDate}`;
}
