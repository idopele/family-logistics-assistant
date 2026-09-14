import type { EventCategory } from './EventCategory';

export type PermissionScope =
  | 'view_schedule'
  | 'edit_schedule'
  | 'view_transportation'
  | 'edit_transportation'
  | 'view_contacts'
  | 'receive_notifications'
  | 'manage_users'
  | 'manage_shared_views';

export interface ScheduleAuthorizationScope {
  allMembers: boolean;
  memberIds: string[];
  allCategories: boolean;
  categories: EventCategory[];
}

export interface AuthorizationContext {
  fullAccess: boolean;
  permissions: PermissionScope[];
  scheduleScope: ScheduleAuthorizationScope;
}
