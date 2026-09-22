import type { AuthorizationContext, EventCategory, PermissionScope } from '../models';
import { isAuthorizationContext } from './authorization';

export type AuthRole = 'owner' | 'admin' | 'member' | 'viewer';
export type AuthUserStatus = 'active' | 'disabled';

export interface AuthSession {
  authenticated: true;
  user: {
    email: string;
    displayName: string;
    status: AuthUserStatus;
    lastLoginAt: string | null;
  };
  workspace: {
    id: string;
    name: string;
    type: 'family' | 'sports_team';
  };
  membership: {
    role: AuthRole;
    status: 'active' | 'disabled';
    scheduleMemberId: string | null;
  };
  authorization?: AuthorizationContext;
}

export interface AuthStartupState {
  authenticated: boolean;
  setupRequired: boolean;
  session: AuthSession | null;
}

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string;
  status: AuthUserStatus;
  role: AuthRole;
  membershipStatus: 'active' | 'disabled';
  lastLoginAt: string | null;
}

export interface ManagedSharedView {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  allMembers: boolean;
  allCategories: boolean;
  userIds: string[];
  memberIds: string[];
  categories: EventCategory[];
  permissions: PermissionScope[];
}

export interface ManagedUserPermissions {
  allMembers: boolean;
  allCategories: boolean;
  memberIds: string[];
  categories: EventCategory[];
  permissions: PermissionScope[];
}

type Fetcher = typeof fetch;

export async function loadAuthStartupState(fetcher: Fetcher = fetch): Promise<AuthStartupState> {
  const response = await fetcher('/api/auth/session', { headers: { Accept: 'application/json' } });
  const payload = await response.json() as unknown;

  if (!response.ok || !isSessionResponse(payload)) {
    throw new Error('Could not load authentication state.');
  }

  return {
    authenticated: payload.authenticated,
    setupRequired: payload.setupRequired,
    session: payload.authenticated ? payload : null,
  };
}

export async function login(email: string, password: string, fetcher: Fetcher = fetch): Promise<AuthSession> {
  return postAuthSession('/api/auth/login', { email, password }, fetcher);
}

export async function bootstrapOwner(
  displayName: string,
  email: string,
  password: string,
  bootstrapToken: string,
  fetcher: Fetcher = fetch,
): Promise<AuthSession> {
  return postAuthSession('/api/auth/bootstrap', { displayName, email, password, bootstrapToken }, fetcher);
}

export async function loadInvite(token: string, fetcher: Fetcher = fetch): Promise<{ email: string; role: Exclude<AuthRole, 'owner'>; expiresAt: string }> {
  const response = await fetcher(`/api/auth/invite?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
  const payload = await response.json() as unknown;

  if (!response.ok || !isInviteResponse(payload)) {
    throw new Error('Invite is invalid.');
  }

  return payload.invite;
}

export async function acceptInvite(token: string, displayName: string, password: string, fetcher: Fetcher = fetch): Promise<AuthSession> {
  return postAuthSession('/api/auth/invite', { token, displayName, password }, fetcher);
}

export async function logout(fetcher: Fetcher = fetch): Promise<void> {
  const response = await postJson('/api/auth/logout', {}, fetcher);

  if (!response.ok) {
    throw new Error('Logout failed.');
  }
}

export async function loadManagedUsers(fetcher: Fetcher = fetch): Promise<{ users: ManagedUser[]; sharedViews: ManagedSharedView[] }> {
  const response = await fetcher('/api/auth/users', { headers: { Accept: 'application/json' } });
  const payload = await response.json() as unknown;

  if (!response.ok || !isManagedUsersResponse(payload)) {
    throw new Error('Could not load users.');
  }

  return payload;
}

export async function createAuthInvite(email: string, role: Exclude<AuthRole, 'owner'>, fetcher: Fetcher = fetch): Promise<string> {
  const response = await postJson('/api/auth/users', { action: 'createInvite', email, role }, fetcher);
  const payload = await response.json() as unknown;

  if (!response.ok || !isInviteCreatedResponse(payload)) {
    throw new Error('Could not create invite.');
  }

  return payload.inviteUrl;
}

export async function setManagedUserStatus(userId: string, status: AuthUserStatus, fetcher: Fetcher = fetch): Promise<void> {
  const response = await postJson('/api/auth/users', { action: 'setUserStatus', userId, status }, fetcher);

  if (!response.ok) {
    throw new Error('Could not update user.');
  }
}

export async function revokeManagedUserSessions(userId: string, fetcher: Fetcher = fetch): Promise<void> {
  const response = await postJson('/api/auth/users', { action: 'revokeSessions', userId }, fetcher);

  if (!response.ok) {
    throw new Error('Could not revoke sessions.');
  }
}

export async function saveManagedSharedView(view: Omit<ManagedSharedView, 'id'> & { id?: string }, fetcher: Fetcher = fetch): Promise<void> {
  const response = await postJson('/api/auth/users', { action: 'saveSharedView', view }, fetcher);

  if (!response.ok) {
    throw new Error('Could not save Shared View.');
  }
}

export async function saveManagedUserPermissions(
  userId: string,
  permissions: ManagedUserPermissions,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const response = await postJson('/api/auth/users', { action: 'saveUserPermissions', userId, permissions }, fetcher);

  if (!response.ok) {
    throw new Error('Could not save user permissions.');
  }
}

async function postAuthSession(path: string, body: Record<string, unknown>, fetcher: Fetcher): Promise<AuthSession> {
  const response = await postJson(path, body, fetcher);
  const payload = await response.json() as unknown;

  if (!response.ok || !isAuthenticatedSession(payload)) {
    throw new Error('Authentication failed.');
  }

  return payload;
}

function postJson(path: string, body: Record<string, unknown>, fetcher: Fetcher): Promise<Response> {
  return fetcher(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function isSessionResponse(value: unknown): value is ({ authenticated: false; setupRequired: boolean } | AuthSession & { setupRequired: false }) {
  if (typeof value !== 'object' || value === null || typeof (value as { authenticated?: unknown }).authenticated !== 'boolean') {
    return false;
  }

  const payload = value as { authenticated: boolean; setupRequired?: unknown };

  return payload.authenticated ? isAuthenticatedSession(value) : typeof payload.setupRequired === 'boolean';
}

function isAuthenticatedSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<AuthSession>;

  return (
    payload.authenticated === true &&
    typeof payload.user?.email === 'string' &&
    typeof payload.user.displayName === 'string' &&
    isAuthRole(payload.membership?.role) &&
    typeof payload.workspace?.id === 'string' &&
    (payload.authorization === undefined || isAuthorizationContext(payload.authorization))
  );
}

function isInviteResponse(value: unknown): value is { valid: true; invite: { email: string; role: Exclude<AuthRole, 'owner'>; expiresAt: string } } {
  const invite = (value as { invite?: { email?: unknown; role?: unknown; expiresAt?: unknown } } | null)?.invite;

  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { valid?: unknown }).valid === true &&
    typeof invite?.email === 'string' &&
    isInviteRole(invite.role) &&
    typeof invite.expiresAt === 'string'
  );
}

function isManagedUsersResponse(value: unknown): value is { users: ManagedUser[]; sharedViews: ManagedSharedView[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { users?: unknown }).users) &&
    ((value as { users: unknown[] }).users).every(isManagedUser) &&
    Array.isArray((value as { sharedViews?: unknown }).sharedViews) &&
    ((value as { sharedViews: unknown[] }).sharedViews).every(isManagedSharedView)
  );
}

function isManagedUser(value: unknown): value is ManagedUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const user = value as Partial<ManagedUser>;

  return typeof user.id === 'string' && typeof user.email === 'string' && typeof user.displayName === 'string' && isAuthRole(user.role);
}

function isInviteCreatedResponse(value: unknown): value is { inviteUrl: string } {
  return typeof value === 'object' && value !== null && typeof (value as { inviteUrl?: unknown }).inviteUrl === 'string';
}

function isManagedSharedView(value: unknown): value is ManagedSharedView {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const view = value as Partial<ManagedSharedView>;

  return (
    typeof view.id === 'string' &&
    typeof view.name === 'string' &&
    (typeof view.description === 'string' || view.description === null) &&
    typeof view.active === 'boolean' &&
    typeof view.allMembers === 'boolean' &&
    typeof view.allCategories === 'boolean' &&
    Array.isArray(view.userIds) &&
    view.userIds.every((id) => typeof id === 'string') &&
    Array.isArray(view.memberIds) &&
    view.memberIds.every((id) => typeof id === 'string') &&
    Array.isArray(view.categories) &&
    view.categories.every((category) => typeof category === 'string') &&
    Array.isArray(view.permissions) &&
    view.permissions.every((permission) => typeof permission === 'string')
  );
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'owner' || value === 'admin' || value === 'member' || value === 'viewer';
}

function isInviteRole(value: unknown): value is Exclude<AuthRole, 'owner'> {
  return value === 'admin' || value === 'member' || value === 'viewer';
}
