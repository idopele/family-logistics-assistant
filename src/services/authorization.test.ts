import { describe, expect, it } from 'vitest';

import type { AuthorizationContext, Event } from '../models';
import { events as seedEvents } from '../data/events';
import { canEditEvent, hasPermission, isEventAuthorized } from './authorization';

const danielBasketball = seedEvents.find((event) => event.childId === 'daniel' && event.category === 'basketball')!;
const emanuelDance = seedEvents.find((event) => event.childId === 'emanuel' && event.category === 'dance')!;
const emanuelSchool = seedEvents.find((event) => event.childId === 'emanuel' && event.category === 'school')!;

describe('authorization helpers', () => {
  it('allows owner/admin full access contexts to see and edit everything', () => {
    const authorization: AuthorizationContext = fullAccess(['view_schedule', 'edit_schedule']);

    expect(isEventAuthorized(authorization, danielBasketball)).toBe(true);
    expect(canEditEvent(authorization, emanuelDance)).toBe(true);
  });

  it('default-denies a member or viewer with no Shared View permissions', () => {
    const authorization = restricted([], ['daniel'], ['basketball']);

    expect(isEventAuthorized(authorization, danielBasketball)).toBe(false);
    expect(hasPermission(authorization, 'view_schedule')).toBe(false);
  });

  it('allows Grandma scope to Daniel basketball only', () => {
    const authorization = restricted(['view_schedule'], ['daniel'], ['basketball']);

    expect(isEventAuthorized(authorization, danielBasketball)).toBe(true);
    expect(isEventAuthorized(authorization, emanuelDance)).toBe(false);
    expect(isEventAuthorized(authorization, emanuelSchool)).toBe(false);
  });

  it('allows Dana scope to Emanuel school and dance only', () => {
    const authorization = restricted(['view_schedule'], ['emanuel'], ['school', 'dance']);

    expect(isEventAuthorized(authorization, emanuelDance)).toBe(true);
    expect(isEventAuthorized(authorization, emanuelSchool)).toBe(true);
    expect(isEventAuthorized(authorization, danielBasketball)).toBe(false);
  });

  it('requires edit permission before scoped mutation UI can edit', () => {
    const viewOnly = restricted(['view_schedule'], ['daniel'], ['basketball']);
    const editor = restricted(['view_schedule', 'edit_schedule'], ['daniel'], ['basketball']);

    expect(canEditEvent(viewOnly, danielBasketball)).toBe(false);
    expect(canEditEvent(editor, danielBasketball)).toBe(true);
    expect(canEditEvent(editor, emanuelDance)).toBe(false);
  });

  it('supports explicit all-members and all-categories flags', () => {
    const allMembers = restricted(['view_schedule'], [], ['dance'], { allMembers: true });
    const allCategories = restricted(['view_schedule'], ['emanuel'], [], { allCategories: true });

    expect(isEventAuthorized(allMembers, emanuelDance)).toBe(true);
    expect(isEventAuthorized(allMembers, danielBasketball)).toBe(false);
    expect(isEventAuthorized(allCategories, emanuelDance)).toBe(true);
    expect(isEventAuthorized(allCategories, emanuelSchool)).toBe(true);
  });

  it('represents the union of multiple Shared Views by combined members, categories, and permissions', () => {
    const authorization = restricted(['view_schedule', 'view_transportation'], ['daniel', 'emanuel'], ['basketball', 'dance']);

    expect(isEventAuthorized(authorization, danielBasketball)).toBe(true);
    expect(isEventAuthorized(authorization, emanuelDance)).toBe(true);
    expect(hasPermission(authorization, 'view_transportation')).toBe(true);
  });
});

function restricted(
  permissions: AuthorizationContext['permissions'],
  memberIds: string[],
  categories: Event['category'][],
  flags: Partial<Pick<AuthorizationContext['scheduleScope'], 'allMembers' | 'allCategories'>> = {},
): AuthorizationContext {
  return {
    fullAccess: false,
    permissions,
    scheduleScope: {
      allMembers: flags.allMembers ?? false,
      memberIds,
      allCategories: flags.allCategories ?? false,
      categories,
    },
  };
}

function fullAccess(permissions: AuthorizationContext['permissions']): AuthorizationContext {
  return {
    fullAccess: true,
    permissions,
    scheduleScope: {
      allMembers: true,
      memberIds: [],
      allCategories: true,
      categories: [],
    },
  };
}
