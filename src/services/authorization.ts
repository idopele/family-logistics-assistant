import type { AuthorizationContext, Event, EventCategory, PermissionScope } from '../models';

export const emptyAuthorizationContext: AuthorizationContext = {
  fullAccess: false,
  permissions: [],
  scheduleScope: {
    allMembers: false,
    memberIds: [],
    allCategories: false,
    categories: [],
  },
};

export function hasPermission(authorization: AuthorizationContext | null | undefined, permission: PermissionScope): boolean {
  return authorization?.fullAccess === true || authorization?.permissions.includes(permission) === true;
}

export function isEventAuthorized(authorization: AuthorizationContext | null | undefined, event: Pick<Event, 'childId' | 'category'>): boolean {
  if (authorization === undefined || authorization === null || authorization.fullAccess) {
    return true;
  }

  if (!hasPermission(authorization, 'view_schedule')) {
    return false;
  }

  const matchesMember = authorization.scheduleScope.allMembers || authorization.scheduleScope.memberIds.includes(event.childId);
  const matchesCategory = authorization.scheduleScope.allCategories || authorization.scheduleScope.categories.includes(event.category);

  return matchesMember && matchesCategory;
}

export function canEditEvent(authorization: AuthorizationContext | null | undefined, event: Pick<Event, 'childId' | 'category'>): boolean {
  return hasPermission(authorization, 'edit_schedule') && (authorization?.fullAccess === true || isEventAuthorized(authorization, event));
}

export function isAuthorizationContext(value: unknown): value is AuthorizationContext {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const context = value as Partial<AuthorizationContext>;
  const scope = context.scheduleScope;

  return (
    typeof context.fullAccess === 'boolean' &&
    Array.isArray(context.permissions) &&
    context.permissions.every(isPermissionScope) &&
    typeof scope?.allMembers === 'boolean' &&
    Array.isArray(scope.memberIds) &&
    scope.memberIds.every((memberId) => typeof memberId === 'string') &&
    typeof scope.allCategories === 'boolean' &&
    Array.isArray(scope.categories) &&
    scope.categories.every(isEventCategory)
  );
}

function isPermissionScope(value: unknown): value is PermissionScope {
  return (
    value === 'view_schedule' ||
    value === 'edit_schedule' ||
    value === 'view_transportation' ||
    value === 'edit_transportation' ||
    value === 'view_contacts' ||
    value === 'receive_notifications' ||
    value === 'manage_users' ||
    value === 'manage_shared_views'
  );
}

function isEventCategory(value: unknown): value is EventCategory {
  return (
    value === 'school' ||
    value === 'basketball' ||
    value === 'dance' ||
    value === 'privateLesson' ||
    value === 'scouts' ||
    value === 'doctor' ||
    value === 'dentist' ||
    value === 'haircut' ||
    value === 'friends' ||
    value === 'family' ||
    value === 'work' ||
    value === 'romanticDate' ||
    value === 'meal' ||
    value === 'birthday' ||
    value === 'exam' ||
    value === 'transportation' ||
    value === 'parentMeeting' ||
    value === 'performance' ||
    value === 'openPractice' ||
    value === 'other'
  );
}
