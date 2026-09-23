import { describe, expect, it } from 'vitest';
import type { Event } from '../models';
import { getEventParticipantIds, sanitizeEventParticipants, withParticipantIds } from './eventParticipants';

const baseEvent: Event = {
  id: 'event-a',
  childId: 'daniel',
  title: 'Dinner',
  category: 'family',
  customCategoryLabel: null,
  date: '2026-09-14',
  startTime: '19:00',
  endTime: null,
  endsNextDay: false,
  location: null,
  notes: null,
  recurrence: null,
  requiresTransportation: false,
  pickupTime: null,
  dropoffTime: null,
  status: 'scheduled',
  createdAt: '2026-09-14T10:00:00.000Z',
  updatedAt: '2026-09-14T10:00:00.000Z',
};

describe('event participant helpers', () => {
  it('treats legacy childId-only events as single-participant events', () => {
    expect(getEventParticipantIds(baseEvent)).toEqual(['daniel']);
  });

  it('preserves new multi-participant events and keeps childId as the first participant', () => {
    expect(withParticipantIds({ ...baseEvent, childId: 'daniel', participantIds: ['daniel', 'emanuel'] })).toMatchObject({
      childId: 'daniel',
      participantIds: ['daniel', 'emanuel'],
    });
  });

  it('sanitizes hidden participants out of event payloads', () => {
    const sanitized = sanitizeEventParticipants(
      { ...baseEvent, participantIds: ['daniel', 'emanuel'] },
      new Set(['daniel']),
    );

    expect(sanitized).toMatchObject({ childId: 'daniel', participantIds: ['daniel'] });
    expect(JSON.stringify(sanitized)).not.toContain('emanuel');
  });
});
