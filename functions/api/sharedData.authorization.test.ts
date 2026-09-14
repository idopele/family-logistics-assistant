import { describe, expect, it } from 'vitest';

import type { AuthorizationContext, Child, Event, EventReminder, TransportationPlan } from '../../src/models';
import { filterSharedStateForAuthorization } from './sharedData';

const hiddenChild: Child = { id: 'emanuel', name: 'עמנואל', color: '#DB2777', isActive: true };
const visibleChild: Child = { id: 'daniel', name: 'Daniel', color: '#2563EB', isActive: true };
const visibleEvent = event('visible-daniel-basketball', 'daniel', 'basketball', 'אימון כדורסל', 'רלף', 'bring ball');
const hiddenEvent = event('hidden-emanuel-dance', 'emanuel', 'dance', 'בלט', 'ליעד', 'private note');
const hiddenTransportation: TransportationPlan = {
  id: 'transport-hidden',
  eventId: hiddenEvent.id,
  occurrenceDate: '2026-09-14',
  outbound: {
    enabled: true,
    driverName: 'Secret Driver',
    time: '16:00',
    occursNextDay: false,
    from: 'Hidden home',
    to: 'Hidden studio',
    passengerChildIds: ['emanuel'],
    additionalPassengers: null,
    notes: 'hidden ride',
  },
  returnTrip: null,
  createdAt: '2026-09-14T10:00:00.000Z',
  updatedAt: '2026-09-14T10:00:00.000Z',
};
const hiddenReminder: EventReminder = {
  id: 'reminder-hidden',
  eventId: hiddenEvent.id,
  occurrenceDate: '2026-09-14',
  reminderMinutesBefore: 30,
  enabled: true,
  createdAt: '2026-09-14T10:00:00.000Z',
  updatedAt: '2026-09-14T10:00:00.000Z',
};

describe('shared data authorization filtering', () => {
  it('returns everything for owner/admin full access', () => {
    const filtered = filterSharedStateForAuthorization(baseState(), {
      fullAccess: true,
      permissions: ['view_schedule', 'view_transportation', 'receive_notifications'],
      scheduleScope: { allMembers: true, memberIds: [], allCategories: true, categories: [] },
    });

    expect(filtered.children).toHaveLength(2);
    expect(filtered.events).toHaveLength(2);
    expect(filtered.transportationPlans).toHaveLength(1);
    expect(filtered.eventReminders).toHaveLength(1);
  });

  it('returns no schedule for a member/viewer with no Shared View', () => {
    const filtered = filterSharedStateForAuthorization(baseState(), defaultDeny());

    expect(filtered.children).toEqual([]);
    expect(filtered.events).toEqual([]);
    expect(filtered.exceptions).toEqual([]);
    expect(filtered.transportationPlans).toEqual([]);
    expect(filtered.eventReminders).toEqual([]);
  });

  it('filters hidden shared API data so titles, names, locations, notes, transportation, and reminders do not leak', () => {
    const filtered = filterSharedStateForAuthorization(baseState(), {
      fullAccess: false,
      permissions: ['view_schedule'],
      scheduleScope: { allMembers: false, memberIds: ['daniel'], allCategories: false, categories: ['basketball'] },
    });
    const body = JSON.stringify(filtered);

    expect(body).toContain('visible-daniel-basketball');
    expect(body).toContain('אימון כדורסל');
    expect(body).not.toContain('עמנואל');
    expect(body).not.toContain('בלט');
    expect(body).not.toContain('ליעד');
    expect(body).not.toContain('private note');
    expect(body).not.toContain('Secret Driver');
    expect(body).not.toContain('reminder-hidden');
  });

  it('shows transportation and reminders only with their dedicated permissions', () => {
    const authorization: AuthorizationContext = {
      fullAccess: false,
      permissions: ['view_schedule', 'view_transportation', 'receive_notifications'],
      scheduleScope: { allMembers: false, memberIds: ['emanuel'], allCategories: false, categories: ['dance'] },
    };
    const filtered = filterSharedStateForAuthorization(baseState(), authorization);

    expect(filtered.transportationPlans).toEqual([hiddenTransportation]);
    expect(filtered.eventReminders).toEqual([hiddenReminder]);
  });
});

function baseState() {
  return {
    children: [visibleChild, hiddenChild],
    events: [visibleEvent, hiddenEvent],
    exceptions: [{ id: 'exception-hidden', eventId: hiddenEvent.id, date: '2026-09-14', type: 'cancelled' as const }],
    transportationPlans: [hiddenTransportation],
    eventReminders: [hiddenReminder],
  };
}

function defaultDeny(): AuthorizationContext {
  return {
    fullAccess: false,
    permissions: [],
    scheduleScope: { allMembers: false, memberIds: [], allCategories: false, categories: [] },
  };
}

function event(id: string, childId: string, category: Event['category'], title: string, location: string, notes: string): Event {
  return {
    id,
    childId,
    title,
    category,
    customCategoryLabel: null,
    date: '2026-09-14',
    startTime: '16:00',
    endTime: null,
    endsNextDay: false,
    location,
    notes,
    recurrence: null,
    requiresTransportation: false,
    pickupTime: null,
    dropoffTime: null,
    status: 'scheduled',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
  };
}
