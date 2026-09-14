import type { AuthorizationContext, Event, EventCategory, PermissionScope } from '../../src/models';
import type { AuthenticatedSession, D1Database } from './authCore';

export const allPermissionScopes: PermissionScope[] = [
  'view_schedule',
  'edit_schedule',
  'view_transportation',
  'edit_transportation',
  'view_contacts',
  'receive_notifications',
  'manage_users',
  'manage_shared_views',
];

const sharedViewPermissionScopes: PermissionScope[] = [
  'view_schedule',
  'edit_schedule',
  'view_transportation',
  'edit_transportation',
  'view_contacts',
  'receive_notifications',
];

const emptyAuthorization: AuthorizationContext = {
  fullAccess: false,
  permissions: [],
  scheduleScope: {
    allMembers: false,
    memberIds: [],
    allCategories: false,
    categories: [],
  },
};

interface SharedViewRow {
  id: string;
  all_schedule_members: number;
  all_categories: number;
}

export function getRoleAuthorizationContext(auth: AuthenticatedSession): AuthorizationContext {
  if (auth.membership.status !== 'active' || auth.user.status !== 'active') {
    return emptyAuthorization;
  }

  if (auth.membership.role === 'owner' || auth.membership.role === 'admin') {
    return {
      fullAccess: true,
      permissions: allPermissionScopes,
      scheduleScope: {
        allMembers: true,
        memberIds: [],
        allCategories: true,
        categories: [],
      },
    };
  }

  return emptyAuthorization;
}

export async function readAuthorizationContext(db: D1Database, auth: AuthenticatedSession): Promise<AuthorizationContext> {
  const roleAuthorization = getRoleAuthorizationContext(auth);

  if (roleAuthorization.fullAccess || auth.membership.status !== 'active' || auth.user.status !== 'active') {
    return roleAuthorization;
  }

  try {
    const { results: views = [] } = await db
      .prepare(
        'SELECT sv.id, sv.all_schedule_members, sv.all_categories FROM shared_views sv JOIN shared_view_users svu ON svu.shared_view_id = sv.id WHERE sv.workspace_id = ? AND sv.active = 1 AND svu.user_id = ? ORDER BY sv.name',
      )
      .bind(auth.workspace.id, auth.user.id)
      .all<SharedViewRow>();

    if (views.length === 0) {
      return emptyAuthorization;
    }

    const viewIds = views.map((view) => view.id);
    const [permissions, memberIds, categories] = await Promise.all([
      readSharedViewValues(db, 'shared_view_permissions', 'permission', viewIds, isPermissionScope),
      readSharedViewValues(db, 'shared_view_schedule_members', 'schedule_member_id', viewIds, isNonEmptyString),
      readSharedViewValues(db, 'shared_view_categories', 'category', viewIds, isEventCategory),
    ]);

    return {
      fullAccess: false,
      permissions: permissions.filter((permission) => sharedViewPermissionScopes.includes(permission)),
      scheduleScope: {
        allMembers: views.some((view) => view.all_schedule_members === 1),
        memberIds,
        allCategories: views.some((view) => view.all_categories === 1),
        categories,
      },
    };
  } catch {
    return emptyAuthorization;
  }
}

export function hasPermission(authorization: AuthorizationContext, permission: PermissionScope): boolean {
  return authorization.fullAccess || authorization.permissions.includes(permission);
}

export function canAccessEvent(authorization: AuthorizationContext, event: Pick<Event, 'childId' | 'category'>, permission: PermissionScope): boolean {
  if (!hasPermission(authorization, permission)) {
    return false;
  }

  return isEventInScheduleScope(authorization, event);
}

export function isEventInScheduleScope(authorization: AuthorizationContext, event: Pick<Event, 'childId' | 'category'>): boolean {
  if (authorization.fullAccess) {
    return true;
  }

  const matchesMember = authorization.scheduleScope.allMembers || authorization.scheduleScope.memberIds.includes(event.childId);
  const matchesCategory = authorization.scheduleScope.allCategories || authorization.scheduleScope.categories.includes(event.category);

  return matchesMember && matchesCategory;
}

async function readSharedViewValues<T extends string>(
  db: D1Database,
  table: string,
  column: string,
  viewIds: string[],
  isValid: (value: unknown) => value is T,
): Promise<T[]> {
  const values = new Set<T>();

  for (const viewId of viewIds) {
    const { results = [] } = await db
      .prepare(`SELECT ${column} AS value FROM ${table} WHERE shared_view_id = ? ORDER BY ${column}`)
      .bind(viewId)
      .all<{ value: unknown }>();

    for (const row of results) {
      if (isValid(row.value)) {
        values.add(row.value);
      }
    }
  }

  return Array.from(values);
}

function isPermissionScope(value: unknown): value is PermissionScope {
  return typeof value === 'string' && allPermissionScopes.includes(value as PermissionScope);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
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
