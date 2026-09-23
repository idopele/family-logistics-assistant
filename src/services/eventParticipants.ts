import type { Event, ScheduleOccurrence } from '../models';

export type ParticipantEvent = Pick<Event, 'childId' | 'participantIds'>;
export type ParticipantOccurrence = Pick<ScheduleOccurrence, 'childId' | 'participantIds'>;

export function getEventParticipantIds(event: ParticipantEvent): string[] {
  return normalizeParticipantIds(event.participantIds, event.childId);
}

export function getOccurrenceParticipantIds(occurrence: ParticipantOccurrence): string[] {
  return normalizeParticipantIds(occurrence.participantIds, occurrence.childId);
}

export function normalizeParticipantIds(participantIds: string[] | undefined, fallbackChildId: string): string[] {
  const ids = (participantIds ?? [fallbackChildId])
    .map((participantId) => participantId.trim())
    .filter((participantId) => participantId !== '');
  const uniqueIds = Array.from(new Set(ids));

  return uniqueIds.length === 0 ? [fallbackChildId] : uniqueIds;
}

export function withParticipantIds<T extends { childId: string; participantIds?: string[] }>(event: T): T {
  const participantIds = normalizeParticipantIds(event.participantIds, event.childId);

  return {
    ...event,
    childId: participantIds[0] ?? event.childId,
    participantIds,
  };
}

export function sanitizeEventParticipants<T extends Event>(event: T, visibleParticipantIds: Set<string>): T | null {
  const participantIds = getEventParticipantIds(event).filter((participantId) => visibleParticipantIds.has(participantId));

  if (participantIds.length === 0) {
    return null;
  }

  return {
    ...event,
    childId: participantIds[0] ?? event.childId,
    participantIds,
  };
}

export function hasAnyParticipantInScope(event: ParticipantEvent, visibleParticipantIds: Set<string>): boolean {
  return getEventParticipantIds(event).some((participantId) => visibleParticipantIds.has(participantId));
}

export function hasAllParticipantsInScope(event: ParticipantEvent, editableParticipantIds: Set<string>): boolean {
  return getEventParticipantIds(event).every((participantId) => editableParticipantIds.has(participantId));
}
