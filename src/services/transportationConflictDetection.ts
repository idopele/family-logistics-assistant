import type {
  Child,
  ScheduleOccurrence,
  TransportationConflict,
  TransportationConflictItem,
  TransportationLeg,
  TransportationPlan,
} from '../models';
import { addDays, compareDates } from '../utils/dateTime';

export const TRANSPORT_CONFLICT_WINDOW_MINUTES = 30;

interface TransportationLegAssignment extends TransportationConflictItem {
  normalizedDriverName: string;
  minutesFromMidnight: number;
}

export type TransportationSaveValidationResult =
  | { status: 'allowed'; conflicts: [] }
  | { status: 'warning'; conflicts: TransportationConflict[] }
  | { status: 'blocked'; conflicts: TransportationConflict[] };

export function normalizeDriverName(driverName: string): string {
  return driverName.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function getTransportationLegEffectiveDate(plan: TransportationPlan, leg: TransportationLeg): string {
  return leg.occursNextDay ? addDays(plan.occurrenceDate, 1) : plan.occurrenceDate;
}

export function detectTransportationConflicts(
  plans: TransportationPlan[],
  occurrences: ScheduleOccurrence[],
  children: Child[],
  startDate: string,
  endDate: string,
): TransportationConflict[] {
  const occurrenceByKey = new Map(occurrences.map((occurrence) => [getOccurrenceKey(occurrence.eventId, occurrence.date), occurrence]));
  const childNamesById = new Map(children.map((child) => [child.id, child.name]));
  const assignments = plans
    .flatMap((plan) => getAssignmentsForPlan(plan, occurrenceByKey, childNamesById))
    .filter((assignment) => compareDates(assignment.effectiveDate, startDate) >= 0 && compareDates(assignment.effectiveDate, endDate) <= 0)
    .sort(compareAssignments);
  const conflicts: TransportationConflict[] = [];

  for (let firstIndex = 0; firstIndex < assignments.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < assignments.length; secondIndex += 1) {
      const first = assignments[firstIndex];
      const second = assignments[secondIndex];

      if (
        first.normalizedDriverName !== second.normalizedDriverName ||
        first.effectiveDate !== second.effectiveDate ||
        isSameAssignment(first, second)
      ) {
        continue;
      }

      const minutesApart = Math.abs(first.minutesFromMidnight - second.minutesFromMidnight);

      if (minutesApart > TRANSPORT_CONFLICT_WINDOW_MINUTES) {
        continue;
      }

      conflicts.push({
        id: `${first.effectiveDate}-${first.normalizedDriverName}-${first.eventId}-${first.direction}-${second.eventId}-${second.direction}`,
        normalizedDriverName: first.normalizedDriverName,
        severity: minutesApart === 0 ? 'sameTime' : 'closeTiming',
        minutesApart,
        first: toConflictItem(first),
        second: toConflictItem(second),
      });
    }
  }

  return conflicts.sort(compareConflicts);
}

export function validateTransportationPlanForSave(
  existingPlans: TransportationPlan[],
  draftPlan: TransportationPlan,
  occurrences: ScheduleOccurrence[],
  children: Child[],
): TransportationSaveValidationResult {
  const existingOtherPlans = existingPlans.filter(
    (plan) => plan.eventId !== draftPlan.eventId || plan.occurrenceDate !== draftPlan.occurrenceDate,
  );
  const conflicts = detectTransportationConflicts(
    [...existingOtherPlans, draftPlan],
    occurrences,
    children,
    '0001-01-01',
    '9999-12-31',
  ).filter((conflict) => isDraftConflictItem(conflict.first, draftPlan) || isDraftConflictItem(conflict.second, draftPlan));

  if (conflicts.length === 0) {
    return { status: 'allowed', conflicts: [] };
  }

  if (conflicts.some((conflict) => conflict.severity === 'sameTime')) {
    return { status: 'blocked', conflicts };
  }

  return { status: 'warning', conflicts };
}

function getAssignmentsForPlan(
  plan: TransportationPlan,
  occurrenceByKey: Map<string, ScheduleOccurrence>,
  childNamesById: Map<string, string>,
): TransportationLegAssignment[] {
  const occurrence = occurrenceByKey.get(getOccurrenceKey(plan.eventId, plan.occurrenceDate));

  if (occurrence === undefined) {
    return [];
  }

  return [
    plan.outbound === null ? null : toAssignment(plan, occurrence, plan.outbound, 'outbound', childNamesById),
    plan.returnTrip === null ? null : toAssignment(plan, occurrence, plan.returnTrip, 'returnTrip', childNamesById),
  ].filter((assignment): assignment is TransportationLegAssignment => assignment !== null);
}

function toAssignment(
  plan: TransportationPlan,
  occurrence: ScheduleOccurrence,
  leg: TransportationLeg,
  direction: 'outbound' | 'returnTrip',
  childNamesById: Map<string, string>,
): TransportationLegAssignment {
  return {
    eventId: plan.eventId,
    occurrenceDate: plan.occurrenceDate,
    effectiveDate: getTransportationLegEffectiveDate(plan, leg),
    direction,
    driverName: leg.driverName,
    normalizedDriverName: normalizeDriverName(leg.driverName),
    time: leg.time,
    minutesFromMidnight: timeToMinutes(leg.time),
    eventTitle: occurrence.title,
    childNames: leg.passengerChildIds.map((childId) => childNamesById.get(childId) ?? childId),
  };
}

function compareAssignments(first: TransportationLegAssignment, second: TransportationLegAssignment): number {
  return (
    first.effectiveDate.localeCompare(second.effectiveDate) ||
    first.time.localeCompare(second.time) ||
    first.normalizedDriverName.localeCompare(second.normalizedDriverName) ||
    first.eventId.localeCompare(second.eventId) ||
    first.occurrenceDate.localeCompare(second.occurrenceDate) ||
    first.direction.localeCompare(second.direction)
  );
}

function compareConflicts(first: TransportationConflict, second: TransportationConflict): number {
  return (
    first.first.effectiveDate.localeCompare(second.first.effectiveDate) ||
    getEarliestTime(first).localeCompare(getEarliestTime(second)) ||
    first.normalizedDriverName.localeCompare(second.normalizedDriverName) ||
    first.id.localeCompare(second.id)
  );
}

function getEarliestTime(conflict: TransportationConflict): string {
  return conflict.first.time <= conflict.second.time ? conflict.first.time : conflict.second.time;
}

function isSameAssignment(first: TransportationLegAssignment, second: TransportationLegAssignment): boolean {
  return (
    first.eventId === second.eventId &&
    first.occurrenceDate === second.occurrenceDate &&
    first.direction === second.direction
  );
}

function toConflictItem(assignment: TransportationLegAssignment): TransportationConflictItem {
  return {
    eventId: assignment.eventId,
    occurrenceDate: assignment.occurrenceDate,
    effectiveDate: assignment.effectiveDate,
    direction: assignment.direction,
    driverName: assignment.driverName,
    time: assignment.time,
    eventTitle: assignment.eventTitle,
    childNames: assignment.childNames,
  };
}

function timeToMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function getOccurrenceKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}|${occurrenceDate}`;
}

function isDraftConflictItem(item: TransportationConflictItem, draftPlan: TransportationPlan): boolean {
  return item.eventId === draftPlan.eventId && item.occurrenceDate === draftPlan.occurrenceDate;
}
