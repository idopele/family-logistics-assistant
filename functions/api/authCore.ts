import type { AuthorizationContext, PermissionScope } from '../../src/models';

type D1Value = string | number | null;

export type D1PreparedStatement = {
  bind: (...values: D1Value[]) => D1PreparedStatement;
  all: <T = unknown>() => Promise<{ results?: T[] }>;
  first: <T = unknown>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

export type D1Database = {
  prepare: (query: string) => D1PreparedStatement;
};

export type AuthRole = 'owner' | 'admin' | 'member' | 'viewer';
export type AuthUserStatus = 'active' | 'disabled';
export type WorkspaceType = 'family' | 'sports_team';
export type BootstrapFailureCode =
  | 'invalid_bootstrap_token'
  | 'bootstrap_closed'
  | 'invalid_account_input'
  | 'workspace_setup_failed'
  | 'user_creation_failed'
  | 'membership_creation_failed'
  | 'session_creation_failed'
  | 'session_lookup_failed'
  | 'database_error'
  | 'unexpected_error';

export interface AuthEnv {
  FAMILY_DB?: D1Database;
  AUTH_BOOTSTRAP_TOKEN?: string;
}

export interface AuthenticatedSession {
  user: SafeAuthUser;
  workspace: SafeWorkspace;
  membership: SafeMembership;
  sessionId: string;
}

export interface SafeAuthUser {
  id: string;
  email: string;
  displayName: string;
  status: AuthUserStatus;
  lastLoginAt: string | null;
}

export interface SafeWorkspace {
  id: string;
  name: string;
  type: WorkspaceType;
}

export interface SafeMembership {
  role: AuthRole;
  status: 'active' | 'disabled';
  scheduleMemberId: string | null;
}

interface UserRow {
  id: string;
  email: string;
  normalized_email: string;
  display_name: string;
  password_hash: string;
  status: AuthUserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface WorkspaceRow {
  id: string;
  name: string;
  type: WorkspaceType;
}

interface MembershipRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: AuthRole;
  status: 'active' | 'disabled';
}

interface SessionRow {
  id: string;
  user_id: string;
  workspace_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

interface InviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  token_hash: string;
  created_by_user_id: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

export const defaultWorkspaceId = 'default-family-workspace';
export const sessionCookieName = '__Host-family_session';
export const localSessionCookieName = 'family_session';
export const sessionLifetimeDays = 30;
export const inviteLifetimeDays = 7;
const passwordHashVersion = 'pbkdf2-sha256-v1';
// Cloudflare Workers/Pages native WebCrypto PBKDF2 currently supports at most 100000 iterations.
export const passwordIterations = 100_000;
const passwordSaltBytes = 16;
const passwordHashBytes = 32;
const sessionTokenBytes = 32;
const inviteTokenBytes = 32;
export const minimumPasswordLength = 10;
export const maximumPasswordLength = 256;

const allPermissionScopes: PermissionScope[] = [
  'view_schedule',
  'edit_schedule',
  'view_transportation',
  'edit_transportation',
  'view_contacts',
  'receive_notifications',
  'manage_users',
  'manage_shared_views',
];

export function getDatabase(env: AuthEnv): D1Database | null {
  return env.FAMILY_DB ?? null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)) && email.length <= 254;
}

export function validateDisplayName(displayName: string): boolean {
  const trimmed = displayName.trim();

  return trimmed.length >= 2 && trimmed.length <= 80;
}

export function validatePassword(password: string): boolean {
  return password.length >= minimumPasswordLength && password.length <= maximumPasswordLength;
}

export function canManageUsers(role: AuthRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canCreateInvite(actorRole: AuthRole, invitedRole: AuthRole): invitedRole is 'admin' | 'member' | 'viewer' {
  return canManageUsers(actorRole) && invitedRole !== 'owner';
}

export async function hashPassword(password: string, salt = randomBytes(passwordSaltBytes)): Promise<string> {
  const derivedHash = await derivePasswordHash(password, salt, passwordIterations);

  return [passwordHashVersion, passwordIterations.toString(), base64UrlEncode(salt), base64UrlEncode(derivedHash)].join('$');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsedHash = parsePasswordHash(storedHash);

  if (parsedHash === null) {
    return false;
  }

  const derivedHash = await derivePasswordHash(password, parsedHash.salt, parsedHash.iterations);

  return timingSafeEqual(derivedHash, parsedHash.hash);
}

export function parsePasswordHash(storedHash: string):
  | { version: typeof passwordHashVersion; iterations: number; salt: Uint8Array; hash: Uint8Array }
  | null {
  const [version, iterationsText, saltText, hashText, extra] = storedHash.split('$');
  const iterations = Number(iterationsText);

  if (
    version !== passwordHashVersion ||
    extra !== undefined ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    saltText === undefined ||
    hashText === undefined
  ) {
    return null;
  }

  const salt = base64UrlDecode(saltText);
  const hash = base64UrlDecode(hashText);

  return salt === null || hash === null ? null : { version, iterations, salt, hash };
}

export async function createSession(db: D1Database, userId: string, workspaceId: string, nowIso = new Date().toISOString()) {
  const token = createToken(sessionTokenBytes);
  const tokenHash = await hashToken(token);
  const sessionId = createId('session');
  const expiresAt = addDaysIso(nowIso, sessionLifetimeDays);

  await db
    .prepare(
      'INSERT INTO auth_sessions (id, user_id, workspace_id, token_hash, created_at, expires_at, last_seen_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)',
    )
    .bind(sessionId, userId, workspaceId, tokenHash, nowIso, expiresAt, nowIso)
    .run();

  return { token, tokenHash, sessionId, expiresAt };
}

export async function authenticateRequest(db: D1Database, request: Request, nowIso = new Date().toISOString()): Promise<AuthenticatedSession | null> {
  const token = readSessionCookie(request.headers.get('Cookie'));

  if (token === null) {
    return null;
  }

  const tokenHash = await hashToken(token);
  const session = await db
    .prepare('SELECT id, user_id, workspace_id, token_hash, expires_at, revoked_at FROM auth_sessions WHERE token_hash = ?')
    .bind(tokenHash)
    .first<SessionRow>();

  if (session === null || session.revoked_at !== null || session.expires_at <= nowIso) {
    return null;
  }

  const auth = await readSafeSessionByUserWorkspace(db, session.user_id, session.workspace_id);

  if (auth === null || auth.user.status !== 'active' || auth.membership.status !== 'active') {
    return null;
  }

  await db.prepare('UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?').bind(nowIso, session.id).run();

  return { ...auth, sessionId: session.id };
}

export async function revokeSession(db: D1Database, sessionId: string, nowIso = new Date().toISOString()): Promise<void> {
  await db.prepare('UPDATE auth_sessions SET revoked_at = ?, last_seen_at = ? WHERE id = ?').bind(nowIso, nowIso, sessionId).run();
}

export async function revokeAllSessionsForUser(db: D1Database, userId: string, nowIso = new Date().toISOString()): Promise<void> {
  await db.prepare('UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, ?), last_seen_at = ? WHERE user_id = ?').bind(nowIso, nowIso, userId).run();
}

export async function ensureDefaultWorkspace(db: D1Database, nowIso = new Date().toISOString()): Promise<SafeWorkspace> {
  await db
    .prepare('INSERT INTO workspaces (id, name, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(defaultWorkspaceId, 'Family', 'family', nowIso, nowIso)
    .run();

  const workspace = await db.prepare('SELECT id, name, type FROM workspaces WHERE id = ?').bind(defaultWorkspaceId).first<WorkspaceRow>();

  if (workspace === null) {
    throw new Error('Default workspace unavailable.');
  }

  return { id: workspace.id, name: workspace.name, type: workspace.type };
}

export async function bootstrapFirstOwner({
  db,
  bootstrapToken,
  expectedBootstrapToken,
  displayName,
  email,
  password,
  nowIso = new Date().toISOString(),
}: {
  db: D1Database;
  bootstrapToken: string;
  expectedBootstrapToken: string | undefined;
  displayName: string;
  email: string;
  password: string;
  nowIso?: string;
}): Promise<{ auth: AuthenticatedSession; sessionToken: string; expiresAt: string }> {
  if (!expectedBootstrapToken || !timingSafeStringEqual(bootstrapToken, expectedBootstrapToken)) {
    throw new AuthError('invalid_bootstrap_token');
  }

  let hasExistingAccounts: boolean;

  try {
    hasExistingAccounts = (await countUsers(db)) > 0 || (await countOwners(db)) > 0;
  } catch (error) {
    throw new BootstrapDiagnosticError('database_error', 'count_users_owners', error);
  }

  if (hasExistingAccounts) {
    throw new AuthError('bootstrap_closed');
  }

  if (!validateDisplayName(displayName) || !validateEmail(email) || !validatePassword(password)) {
    throw new AuthError('invalid_account_input');
  }

  const workspace = await runBootstrapStage('workspace_setup_failed', 'ensureDefaultWorkspace', () =>
    ensureDefaultWorkspace(db, nowIso),
  );
  const user = await runBootstrapStage('user_creation_failed', 'createUser', () =>
    createUser(db, { email, displayName, password, nowIso }),
  );

  await runBootstrapStage('membership_creation_failed', 'createMembership', () =>
    createMembership(db, workspace.id, user.id, 'owner', nowIso),
  );

  const session = await runBootstrapStage('session_creation_failed', 'createSession', () =>
    createSession(db, user.id, workspace.id, nowIso),
  );
  const auth = await runBootstrapStage('session_lookup_failed', 'readSafeSessionByUserWorkspace', () =>
    readSafeSessionByUserWorkspace(db, user.id, workspace.id),
  );

  if (auth === null) {
    throw new BootstrapDiagnosticError('session_lookup_failed', 'readSafeSessionByUserWorkspace');
  }

  return { auth: { ...auth, sessionId: session.sessionId }, sessionToken: session.token, expiresAt: session.expiresAt };
}

export async function loginUser({
  db,
  email,
  password,
  nowIso = new Date().toISOString(),
}: {
  db: D1Database;
  email: string;
  password: string;
  nowIso?: string;
}): Promise<{ auth: AuthenticatedSession; sessionToken: string; expiresAt: string } | null> {
  const user = await readUserByNormalizedEmail(db, normalizeEmail(email));

  if (user === null || user.status !== 'active' || !(await verifyPassword(password, user.password_hash))) {
    return null;
  }

  const membership = await readPrimaryMembership(db, user.id);

  if (membership === null || membership.status !== 'active') {
    return null;
  }

  const session = await createSession(db, user.id, membership.workspace_id, nowIso);
  await db.prepare('UPDATE app_users SET last_login_at = ?, updated_at = ? WHERE id = ?').bind(nowIso, nowIso, user.id).run();
  const auth = await readSafeSessionByUserWorkspace(db, user.id, membership.workspace_id);

  return auth === null ? null : { auth: { ...auth, sessionId: session.sessionId }, sessionToken: session.token, expiresAt: session.expiresAt };
}

export async function createInvite({
  db,
  actor,
  email,
  role,
  origin,
  nowIso = new Date().toISOString(),
}: {
  db: D1Database;
  actor: AuthenticatedSession;
  email: string;
  role: AuthRole;
  origin: string;
  nowIso?: string;
}): Promise<{ invite: SafeInvite; rawToken: string; inviteUrl: string }> {
  if (!canCreateInvite(actor.membership.role, role) || !validateEmail(email)) {
    throw new AuthError('forbidden');
  }

  const token = createToken(inviteTokenBytes);
  const tokenHash = await hashToken(token);
  const invite: SafeInvite = {
    id: createId('invite'),
    workspaceId: actor.workspace.id,
    email: normalizeEmail(email),
    role,
    createdAt: nowIso,
    expiresAt: addDaysIso(nowIso, inviteLifetimeDays),
    acceptedAt: null,
    revokedAt: null,
  };

  await db
    .prepare(
      'INSERT INTO auth_invites (id, workspace_id, email, role, token_hash, created_by_user_id, created_at, expires_at, accepted_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)',
    )
    .bind(invite.id, invite.workspaceId, invite.email, invite.role, tokenHash, actor.user.id, invite.createdAt, invite.expiresAt)
    .run();

  return { invite, rawToken: token, inviteUrl: `${origin}/?invite=${encodeURIComponent(token)}` };
}

export interface SafeInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: 'admin' | 'member' | 'viewer';
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export async function readInviteByToken(db: D1Database, token: string, nowIso = new Date().toISOString()): Promise<SafeInvite | null> {
  const row = await db.prepare('SELECT id, workspace_id, email, role, token_hash, created_by_user_id, created_at, expires_at, accepted_at, revoked_at FROM auth_invites WHERE token_hash = ?')
    .bind(await hashToken(token))
    .first<InviteRow>();

  if (row === null || row.accepted_at !== null || row.revoked_at !== null || row.expires_at <= nowIso) {
    return null;
  }

  return inviteFromRow(row);
}

export async function acceptInvite({
  db,
  token,
  displayName,
  password,
  nowIso = new Date().toISOString(),
}: {
  db: D1Database;
  token: string;
  displayName: string;
  password: string;
  nowIso?: string;
}): Promise<{ auth: AuthenticatedSession; sessionToken: string; expiresAt: string }> {
  const invite = await readInviteByToken(db, token, nowIso);

  if (invite === null) {
    throw new AuthError('invalid_invite');
  }

  assertValidAccountInput(displayName, invite.email, password);

  const existingUser = await readUserByNormalizedEmail(db, normalizeEmail(invite.email));
  let userId: string;

  if (existingUser === null) {
    userId = (await createUser(db, { email: invite.email, displayName, password, nowIso })).id;
  } else if (existingUser.status !== 'active') {
    throw new AuthError('invalid_invite');
  } else {
    userId = existingUser.id;
  }

  await createMembership(db, invite.workspaceId, userId, invite.role, nowIso);
  await db.prepare('UPDATE auth_invites SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL').bind(nowIso, invite.id).run();

  const session = await createSession(db, userId, invite.workspaceId, nowIso);
  const auth = await readSafeSessionByUserWorkspace(db, userId, invite.workspaceId);

  if (auth === null) {
    throw new Error('Invite session unavailable.');
  }

  return { auth: { ...auth, sessionId: session.sessionId }, sessionToken: session.token, expiresAt: session.expiresAt };
}

export async function listWorkspaceUsers(db: D1Database, actor: AuthenticatedSession): Promise<SafeManagedUser[]> {
  if (!canManageUsers(actor.membership.role)) {
    throw new AuthError('forbidden');
  }

  const { results = [] } = await db
    .prepare(
      'SELECT u.id, u.email, u.display_name, u.status, u.last_login_at, m.role, m.status AS membership_status FROM app_users u JOIN workspace_memberships m ON m.user_id = u.id WHERE m.workspace_id = ? ORDER BY u.display_name',
    )
    .bind(actor.workspace.id)
    .all<{ id: string; email: string; display_name: string; status: AuthUserStatus; last_login_at: string | null; role: AuthRole; membership_status: 'active' | 'disabled' }>();

  return results.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    status: row.status,
    role: row.role,
    membershipStatus: row.membership_status,
    lastLoginAt: row.last_login_at,
  }));
}

export interface SafeManagedUser {
  id: string;
  email: string;
  displayName: string;
  status: AuthUserStatus;
  role: AuthRole;
  membershipStatus: 'active' | 'disabled';
  lastLoginAt: string | null;
}

export async function setUserStatus(db: D1Database, actor: AuthenticatedSession, targetUserId: string, status: AuthUserStatus, nowIso = new Date().toISOString()): Promise<void> {
  if (!canManageUsers(actor.membership.role)) {
    throw new AuthError('forbidden');
  }

  if (status === 'disabled' && (await wouldDisableOnlyOwner(db, actor.workspace.id, targetUserId))) {
    throw new AuthError('only_owner');
  }

  await db.prepare('UPDATE app_users SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso, targetUserId).run();

  if (status === 'disabled') {
    await revokeAllSessionsForUser(db, targetUserId, nowIso);
  }
}

export async function createManagedUser({
  db,
  actor,
  email,
  displayName,
  password,
  role,
  nowIso = new Date().toISOString(),
}: {
  db: D1Database;
  actor: AuthenticatedSession;
  email: string;
  displayName: string;
  password: string;
  role: Exclude<AuthRole, 'owner'>;
  nowIso?: string;
}): Promise<SafeManagedUser> {
  if (!canCreateManagedRole(actor.membership.role, role) || !validateDisplayName(displayName) || !validateEmail(email) || !validatePassword(password)) {
    throw new AuthError('bad_request');
  }

  if (await readUserByNormalizedEmail(db, normalizeEmail(email)) !== null) {
    throw new AuthError('duplicate_email');
  }

  const user = await createUser(db, { email, displayName, password, nowIso });
  await createMembership(db, actor.workspace.id, user.id, role, nowIso);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    role,
    membershipStatus: 'active',
    lastLoginAt: null,
  };
}

export async function resetManagedUserPassword(
  db: D1Database,
  actor: AuthenticatedSession,
  targetUserId: string,
  newPassword: string,
  nowIso = new Date().toISOString(),
): Promise<void> {
  if (!canManageUsers(actor.membership.role) || !validatePassword(newPassword)) {
    throw new AuthError('forbidden');
  }

  const target = await readManagedUserRole(db, actor.workspace.id, targetUserId);

  if (target === null || !canResetPasswordForRole(actor.membership.role, target.role)) {
    throw new AuthError('forbidden');
  }

  await db
    .prepare('UPDATE app_users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(await hashPassword(newPassword), nowIso, targetUserId)
    .run();
  await revokeAllSessionsForUser(db, targetUserId, nowIso);
}

export async function revokeUnusedInvite(db: D1Database, actor: AuthenticatedSession, inviteId: string, nowIso = new Date().toISOString()): Promise<void> {
  if (!canManageUsers(actor.membership.role)) {
    throw new AuthError('forbidden');
  }

  await db
    .prepare('UPDATE auth_invites SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND accepted_at IS NULL')
    .bind(nowIso, inviteId, actor.workspace.id)
    .run();
}

export async function associatePushSubscriptionWithUser(db: D1Database, endpoint: string, userId: string, nowIso = new Date().toISOString()): Promise<void> {
  await db.prepare('UPDATE push_subscriptions SET user_id = ?, updated_at = ? WHERE endpoint = ?').bind(userId, nowIso, endpoint).run();
}

export function buildSessionCookie(token: string, request: Request, expiresAt: string): string {
  const secure = isSecureRequest(request);
  const cookieName = secure ? sessionCookieName : localSessionCookieName;
  const attributes = [`${cookieName}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Expires=${new Date(expiresAt).toUTCString()}`];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function buildExpiredSessionCookie(request: Request): string {
  const secure = isSecureRequest(request);
  const cookieName = secure ? sessionCookieName : localSessionCookieName;
  const attributes = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];

  if (secure) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function assertSameOriginMutation(request: Request): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    return;
  }

  const contentType = request.headers.get('Content-Type');

  if (contentType !== null && !contentType.toLowerCase().startsWith('application/json')) {
    throw new AuthError('bad_request');
  }

  const origin = request.headers.get('Origin');

  if (origin !== null && origin !== new URL(request.url).origin) {
    throw new AuthError('bad_origin');
  }
}

export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function safeAuthPayload(auth: AuthenticatedSession) {
  return {
    user: auth.user,
    workspace: auth.workspace,
    membership: auth.membership,
    authorization: getRoleAuthorizationContext(auth),
  };
}

export class AuthError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export class BootstrapDiagnosticError extends Error {
  readonly code: BootstrapFailureCode;
  readonly stage: string;
  readonly causeValue?: unknown;

  constructor(
    code: BootstrapFailureCode,
    stage: string,
    causeValue?: unknown,
  ) {
    super(code);
    this.code = code;
    this.stage = stage;
    this.causeValue = causeValue;
  }
}

export function getSafeBootstrapFailureCode(error: unknown): BootstrapFailureCode {
  if (error instanceof AuthError) {
    return isBootstrapFailureCode(error.code) ? error.code : 'unexpected_error';
  }

  if (error instanceof BootstrapDiagnosticError) {
    return error.code;
  }

  return 'unexpected_error';
}

export function getSafeBootstrapFailureLog(error: unknown): { code: BootstrapFailureCode; stage: string; errorName: string } {
  if (error instanceof BootstrapDiagnosticError) {
    return {
      code: error.code,
      stage: error.stage,
      errorName: getErrorName(error.causeValue),
    };
  }

  return {
    code: getSafeBootstrapFailureCode(error),
    stage: error instanceof AuthError ? error.code : 'unexpected',
    errorName: getErrorName(error),
  };
}

async function createUser(
  db: D1Database,
  { email, displayName, password, nowIso }: { email: string; displayName: string; password: string; nowIso: string },
): Promise<SafeAuthUser> {
  const user = {
    id: createId('user'),
    email: email.trim(),
    normalizedEmail: normalizeEmail(email),
    displayName: displayName.trim(),
    passwordHash: await hashPassword(password),
  };

  await db
    .prepare(
      'INSERT INTO app_users (id, email, normalized_email, display_name, password_hash, status, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)',
    )
    .bind(user.id, user.email, user.normalizedEmail, user.displayName, user.passwordHash, 'active', nowIso, nowIso)
    .run();

  return { id: user.id, email: user.email, displayName: user.displayName, status: 'active', lastLoginAt: null };
}

async function createMembership(db: D1Database, workspaceId: string, userId: string, role: AuthRole, nowIso: string): Promise<void> {
  await db
    .prepare(
      'INSERT INTO workspace_memberships (id, workspace_id, user_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role, status = excluded.status, updated_at = excluded.updated_at',
    )
    .bind(createId('membership'), workspaceId, userId, role, 'active', nowIso, nowIso)
    .run();
}

async function countUsers(db: D1Database): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM app_users').first<{ count: number }>();

  return row?.count ?? 0;
}

async function countOwners(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM workspace_memberships WHERE role = 'owner' AND status = 'active'")
    .first<{ count: number }>();

  return row?.count ?? 0;
}

async function readUserByNormalizedEmail(db: D1Database, normalizedEmail: string): Promise<UserRow | null> {
  return db.prepare('SELECT id, email, normalized_email, display_name, password_hash, status, created_at, updated_at, last_login_at FROM app_users WHERE normalized_email = ?')
    .bind(normalizedEmail)
    .first<UserRow>();
}

async function readPrimaryMembership(db: D1Database, userId: string): Promise<MembershipRow | null> {
  return db
    .prepare('SELECT id, workspace_id, user_id, role, status FROM workspace_memberships WHERE user_id = ? AND status = ? ORDER BY created_at LIMIT 1')
    .bind(userId, 'active')
    .first<MembershipRow>();
}

async function readSafeSessionByUserWorkspace(db: D1Database, userId: string, workspaceId: string): Promise<Omit<AuthenticatedSession, 'sessionId'> | null> {
  const [user, workspace, membership, link] = await Promise.all([
    db.prepare('SELECT id, email, normalized_email, display_name, password_hash, status, created_at, updated_at, last_login_at FROM app_users WHERE id = ?')
      .bind(userId)
      .first<UserRow>(),
    db.prepare('SELECT id, name, type FROM workspaces WHERE id = ?').bind(workspaceId).first<WorkspaceRow>(),
    db.prepare('SELECT id, workspace_id, user_id, role, status FROM workspace_memberships WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .first<MembershipRow>(),
    db.prepare('SELECT schedule_member_id FROM user_schedule_member_links WHERE workspace_id = ? AND user_id = ?')
      .bind(workspaceId, userId)
      .first<{ schedule_member_id: string }>(),
  ]);

  if (user === null || workspace === null || membership === null) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      status: user.status,
      lastLoginAt: user.last_login_at,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
    },
    membership: {
      role: membership.role,
      status: membership.status,
      scheduleMemberId: link?.schedule_member_id ?? null,
    },
  };
}

async function wouldDisableOnlyOwner(db: D1Database, workspaceId: string, targetUserId: string): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM workspace_memberships m JOIN app_users u ON u.id = m.user_id WHERE m.workspace_id = ? AND m.role = 'owner' AND m.status = 'active' AND u.status = 'active' AND u.id != ?",
    )
    .bind(workspaceId, targetUserId)
    .first<{ count: number }>();
  const targetMembership = await db
    .prepare("SELECT role FROM workspace_memberships WHERE workspace_id = ? AND user_id = ? AND role = 'owner'")
    .bind(workspaceId, targetUserId)
    .first<{ role: AuthRole }>();

  return targetMembership !== null && (row?.count ?? 0) === 0;
}

async function readManagedUserRole(db: D1Database, workspaceId: string, targetUserId: string): Promise<{ role: AuthRole } | null> {
  return db
    .prepare('SELECT role FROM workspace_memberships WHERE workspace_id = ? AND user_id = ?')
    .bind(workspaceId, targetUserId)
    .first<{ role: AuthRole }>();
}

function canResetPasswordForRole(actorRole: AuthRole, targetRole: AuthRole): boolean {
  if (actorRole === 'owner') {
    return targetRole === 'admin' || targetRole === 'member' || targetRole === 'viewer';
  }

  if (actorRole === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer';
  }

  return false;
}

function canCreateManagedRole(actorRole: AuthRole, targetRole: AuthRole): targetRole is 'admin' | 'member' | 'viewer' {
  if (actorRole === 'owner') {
    return targetRole === 'admin' || targetRole === 'member' || targetRole === 'viewer';
  }

  if (actorRole === 'admin') {
    return targetRole === 'member' || targetRole === 'viewer';
  }

  return false;
}

function assertValidAccountInput(displayName: string, email: string, password: string): void {
  if (!validateDisplayName(displayName) || !validateEmail(email) || !validatePassword(password)) {
    throw new AuthError('bad_request');
  }
}

async function runBootstrapStage<T>(
  code: BootstrapFailureCode,
  stage: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AuthError || error instanceof BootstrapDiagnosticError) {
      throw error;
    }

    throw new BootstrapDiagnosticError(code, stage, error);
  }
}

function isBootstrapFailureCode(code: string): code is BootstrapFailureCode {
  return (
    code === 'invalid_bootstrap_token' ||
    code === 'bootstrap_closed' ||
    code === 'invalid_account_input' ||
    code === 'workspace_setup_failed' ||
    code === 'user_creation_failed' ||
    code === 'membership_creation_failed' ||
    code === 'session_creation_failed' ||
    code === 'session_lookup_failed' ||
    code === 'database_error' ||
    code === 'unexpected_error'
  );
}

function getErrorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

function getRoleAuthorizationContext(auth: AuthenticatedSession): AuthorizationContext {
  if (auth.user.status !== 'active' || auth.membership.status !== 'active') {
    return {
      fullAccess: false,
      permissions: [],
      scheduleScope: { allMembers: false, memberIds: [], allCategories: false, categories: [] },
    };
  }

  if (auth.membership.role === 'owner' || auth.membership.role === 'admin') {
    return {
      fullAccess: true,
      permissions: allPermissionScopes,
      scheduleScope: { allMembers: true, memberIds: [], allCategories: true, categories: [] },
    };
  }

  return {
    fullAccess: false,
    permissions: [],
    scheduleScope: { allMembers: false, memberIds: [], allCategories: false, categories: [] },
  };
}

function inviteFromRow(row: InviteRow): SafeInvite {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  };
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    passwordKey,
    passwordHashBytes * 8,
  );

  return new Uint8Array(bits);
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));

  return base64UrlEncode(new Uint8Array(digest));
}

function readSessionCookie(cookieHeader: string | null): string | null {
  if (cookieHeader === null) {
    return null;
  }

  const prefix = `${sessionCookieName}=`;
  const localPrefix = `${localSessionCookieName}=`;
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix) || part.startsWith(localPrefix));

  if (cookie === undefined) {
    return null;
  }

  return cookie.startsWith(prefix) ? cookie.slice(prefix.length) : cookie.slice(localPrefix.length);
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return bytes;
}

function createToken(length: number): string {
  return base64UrlEncode(randomBytes(length));
}

function createId(prefix: string): string {
  return `${prefix}-${createToken(16)}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return diff === 0;
}

function timingSafeStringEqual(left: string, right: string): boolean {
  return timingSafeEqual(new TextEncoder().encode(left), new TextEncoder().encode(right));
}

function addDaysIso(nowIso: string, days: number): string {
  const date = new Date(nowIso);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString();
}

function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);

  return url.protocol === 'https:';
}
