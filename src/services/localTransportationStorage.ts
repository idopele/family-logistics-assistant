import type { ScheduleOccurrence, TransportationLeg, TransportationPlan } from '../models';

export const transportationPlansStorageKey = 'family-logistics-transportation-plans-v1';

export function loadTransportationPlans(): TransportationPlan[] {
  const storage = getStorage();

  if (storage === null) {
    return [];
  }

  const rawValue = storage.getItem(transportationPlansStorageKey);

  if (rawValue === null) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter(isStoredTransportationPlan);
  } catch {
    return [];
  }
}

export function saveTransportationPlans(plans: TransportationPlan[]): void {
  const storage = getStorage();

  if (storage === null) {
    return;
  }

  storage.setItem(transportationPlansStorageKey, JSON.stringify(plans));
}

export function getTransportationPlanForOccurrence(
  plans: TransportationPlan[],
  eventId: string,
  occurrenceDate: string,
): TransportationPlan | null {
  return plans.find((plan) => plan.eventId === eventId && plan.occurrenceDate === occurrenceDate) ?? null;
}

export function getTransportationPlanForScheduleOccurrence(
  plans: TransportationPlan[],
  occurrence: ScheduleOccurrence,
): TransportationPlan | null {
  return getTransportationPlanForOccurrence(plans, occurrence.eventId, occurrence.date);
}

export function upsertTransportationPlan(
  plans: TransportationPlan[],
  nextPlan: TransportationPlan,
  timestamp = new Date().toISOString(),
): TransportationPlan[] {
  const existingPlan = getTransportationPlanForOccurrence(plans, nextPlan.eventId, nextPlan.occurrenceDate);

  if (existingPlan === null) {
    return [...plans, nextPlan];
  }

  const updatedPlan: TransportationPlan = {
    ...nextPlan,
    id: existingPlan.id,
    createdAt: existingPlan.createdAt,
    updatedAt: timestamp,
  };

  return plans.map((plan) => (plan.id === existingPlan.id ? updatedPlan : plan));
}

export function deleteTransportationPlan(
  plans: TransportationPlan[],
  eventId: string,
  occurrenceDate: string,
): TransportationPlan[] {
  return plans.filter((plan) => plan.eventId !== eventId || plan.occurrenceDate !== occurrenceDate);
}

export function deleteTransportationPlansForEvent(plans: TransportationPlan[], eventId: string): TransportationPlan[] {
  return plans.filter((plan) => plan.eventId !== eventId);
}

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function isStoredTransportationPlan(value: unknown): value is TransportationPlan {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const plan = value as Partial<TransportationPlan>;

  return (
    typeof plan.id === 'string' &&
    typeof plan.eventId === 'string' &&
    typeof plan.occurrenceDate === 'string' &&
    (plan.outbound === null || isStoredTransportationLeg(plan.outbound)) &&
    (plan.returnTrip === null || isStoredTransportationLeg(plan.returnTrip)) &&
    (plan.outbound !== null || plan.returnTrip !== null) &&
    typeof plan.createdAt === 'string' &&
    typeof plan.updatedAt === 'string'
  );
}

function isStoredTransportationLeg(value: unknown): value is TransportationLeg {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const leg = value as Partial<TransportationLeg>;

  return (
    leg.enabled === true &&
    typeof leg.driverName === 'string' &&
    typeof leg.time === 'string' &&
    (typeof leg.from === 'string' || leg.from === null) &&
    (typeof leg.to === 'string' || leg.to === null) &&
    Array.isArray(leg.passengerChildIds) &&
    leg.passengerChildIds.every((childId) => typeof childId === 'string') &&
    (typeof leg.additionalPassengers === 'string' || leg.additionalPassengers === null) &&
    (typeof leg.notes === 'string' || leg.notes === null)
  );
}
