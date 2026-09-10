import { describe, expect, it, vi } from 'vitest';

import {
  acceptInvite,
  associatePushSubscriptionWithUser,
  authenticateRequest,
  bootstrapFirstOwner,
  buildExpiredSessionCookie,
  buildSessionCookie,
  canCreateInvite,
  createInvite,
  hashPassword,
  inviteLifetimeDays,
  loginUser,
  maximumPasswordLength,
  minimumPasswordLength,
  normalizeEmail,
  parsePasswordHash,
  revokeAllSessionsForUser,
  revokeSession,
  safeAuthPayload,
  sessionCookieName,
  sessionLifetimeDays,
  setUserStatus,
  verifyPassword,
} from './authCore';
import { onRequestPost as handleBootstrapRequest } from './auth/bootstrap';

const nowIso = '2026-09-10T10:00:00.000Z';

describe('authCore password hashing', () => {
  it('stores passwords only as versioned salted hashes and verifies them', async () => {
    const firstHash = await hashPassword('correct horse battery');
    const secondHash = await hashPassword('correct horse battery');

    expect(firstHash).not.toBe('correct horse battery');
    expect(firstHash).not.toBe(secondHash);
    expect(parsePasswordHash(firstHash)?.version).toBe('pbkdf2-sha256-v1');
    await expect(verifyPassword('correct horse battery', firstHash)).resolves.toBe(true);
    await expect(verifyPassword('wrong horse battery', firstHash)).resolves.toBe(false);
  });

  it('normalizes email consistently', () => {
    expect(normalizeEmail('  Parent@Example.COM ')).toBe('parent@example.com');
  });

  it('keeps the documented password length policy unchanged', () => {
    expect(minimumPasswordLength).toBe(10);
    expect(maximumPasswordLength).toBe(256);
  });
});

describe('authCore sessions, bootstrap, invites, and account management', () => {
  it('bootstraps exactly one owner and never returns password hashes', async () => {
    const db = new FakeAuthD1Database();
    const result = await bootstrapFirstOwner({
      db,
      bootstrapToken: 'setup-secret',
      expectedBootstrapToken: 'setup-secret',
      displayName: 'Ido',
      email: 'Ido@Example.com',
      password: 'family password',
      nowIso,
    });

    expect(db.workspaces).toHaveLength(1);
    expect(db.users).toHaveLength(1);
    expect(db.users[0]?.password_hash).not.toBe('family password');
    expect(db.memberships[0]?.role).toBe('owner');
    expect(safeAuthPayload(result.auth)).not.toHaveProperty('password_hash');
    await expect(
      bootstrapFirstOwner({
        db,
        bootstrapToken: 'setup-secret',
        expectedBootstrapToken: 'setup-secret',
        displayName: 'Second',
        email: 'second@example.com',
        password: 'family password',
        nowIso,
      }),
    ).rejects.toThrow();
  });

  it('rejects a wrong bootstrap token', async () => {
    await expect(
      bootstrapFirstOwner({
        db: new FakeAuthD1Database(),
        bootstrapToken: 'wrong',
        expectedBootstrapToken: 'setup-secret',
        displayName: 'Ido',
        email: 'ido@example.com',
        password: 'family password',
        nowIso,
      }),
    ).rejects.toThrow();
  });

  it('returns safe bootstrap diagnostic codes for known failures', async () => {
    await expectBootstrapCode(new FakeAuthD1Database(), { bootstrapToken: 'wrong' }, 'invalid_bootstrap_token');

    const existingDb = new FakeAuthD1Database();
    await createOwner(existingDb);
    await expectBootstrapCode(existingDb, {}, 'bootstrap_closed');

    await expectBootstrapCode(new FakeAuthD1Database(), { displayName: 'I', email: 'bad', password: 'short' }, 'invalid_account_input');
  });

  it('returns a safe diagnostic code for unexpected bootstrap internals without leaking secrets', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = new FakeAuthD1Database({ failOnQueryIncludes: 'INSERT INTO app_users' });
    const response = await callBootstrapRoute(db, {
      bootstrapToken: 'setup-secret',
      password: 'super secret password',
    });
    const responseText = await response.text();

    expect(response.status).toBe(403);
    expect(responseText).toContain('"code":"user_creation_failed"');
    expect(responseText).toContain('Initial setup could not be completed.');
    expect(responseText).not.toContain('setup-secret');
    expect(responseText).not.toContain('super secret password');
    expect(responseText).not.toContain('pbkdf2-sha256-v1');
    expect(responseText).not.toContain('session');
    expect(consoleError).toHaveBeenCalledWith('bootstrap failed', {
      code: 'user_creation_failed',
      stage: 'createUser',
      errorName: 'Error',
    });
    consoleError.mockRestore();
  });

  it('keeps successful bootstrap response safe and unchanged', async () => {
    const response = await callBootstrapRoute(new FakeAuthD1Database(), { bootstrapToken: 'setup-secret' });
    const responseText = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(responseText).toContain('"authenticated":true');
    expect(responseText).toContain('"displayName":"Ido"');
    expect(responseText).not.toContain('setup-secret');
    expect(responseText).not.toContain('family password');
    expect(responseText).not.toContain('pbkdf2-sha256-v1');
    expect(responseText).not.toContain(response.headers.get('Set-Cookie') ?? 'missing-cookie');
  });

  it('login creates hashed sessions and valid sessions authenticate until expired or revoked', async () => {
    const db = new FakeAuthD1Database();
    const bootstrap = await createOwner(db);
    const login = await loginUser({ db, email: 'owner@example.com', password: 'family password', nowIso });

    expect(login).not.toBeNull();
    expect(db.sessions.at(-1)?.token_hash).not.toBe(login?.sessionToken);
    expect(buildSessionCookie(login?.sessionToken ?? '', new Request('https://family.example.test'), login?.expiresAt ?? '')).toContain('HttpOnly');
    expect(buildSessionCookie(login?.sessionToken ?? '', new Request('https://family.example.test'), login?.expiresAt ?? '')).toContain('Secure');
    expect(buildSessionCookie(login?.sessionToken ?? '', new Request('https://family.example.test'), login?.expiresAt ?? '')).toContain('SameSite=Lax');
    expect(buildExpiredSessionCookie(new Request('https://family.example.test'))).toContain('Max-Age=0');

    const cookie = `${sessionCookieName}=${login?.sessionToken}`;
    await expect(authenticateRequest(db, new Request('https://family.example.test', { headers: { Cookie: cookie } }), nowIso)).resolves.not.toBeNull();
    await expect(
      authenticateRequest(db, new Request('https://family.example.test', { headers: { Cookie: cookie } }), addDays(nowIso, sessionLifetimeDays + 1)),
    ).resolves.toBeNull();

    await revokeSession(db, bootstrap.auth.sessionId, nowIso);
    await expect(
      authenticateRequest(db, new Request('https://family.example.test', { headers: { Cookie: `${sessionCookieName}=${bootstrap.sessionToken}` } }), nowIso),
    ).resolves.toBeNull();
  });

  it('disabled users cannot login or use old sessions', async () => {
    const db = new FakeAuthD1Database();
    const owner = await createOwner(db);
    const invite = await createInvite({
      db,
      actor: owner.auth,
      email: 'member@example.com',
      role: 'member',
      origin: 'https://family.example.test',
      nowIso,
    });
    const accepted = await acceptInvite({ db, token: invite.rawToken, displayName: 'Member', password: 'member password', nowIso });

    await setUserStatus(db, owner.auth, accepted.auth.user.id, 'disabled', nowIso);

    await expect(loginUser({ db, email: 'member@example.com', password: 'member password', nowIso })).resolves.toBeNull();
    await expect(
      authenticateRequest(db, new Request('https://family.example.test', { headers: { Cookie: `${sessionCookieName}=${accepted.sessionToken}` } }), nowIso),
    ).resolves.toBeNull();
  });

  it('enforces invite roles, hashes invite tokens, and rejects expired, revoked, or used invites', async () => {
    const db = new FakeAuthD1Database();
    const owner = await createOwner(db);

    expect(canCreateInvite('owner', 'owner')).toBe(false);
    expect(canCreateInvite('member', 'viewer')).toBe(false);

    const invite = await createInvite({ db, actor: owner.auth, email: 'Viewer@Example.com', role: 'viewer', origin: 'https://family.example.test', nowIso });

    expect(invite.inviteUrl).toContain('?invite=');
    expect(db.invites[0]?.token_hash).not.toBe(invite.rawToken);

    await expect(
      acceptInvite({ db, token: invite.rawToken, displayName: 'Late Viewer', password: 'viewer password', nowIso: addDays(nowIso, inviteLifetimeDays + 1) }),
    ).rejects.toThrow();

    const accepted = await acceptInvite({ db, token: invite.rawToken, displayName: 'Viewer', password: 'viewer password', nowIso });
    expect(accepted.auth.membership.role).toBe('viewer');
    await expect(acceptInvite({ db, token: invite.rawToken, displayName: 'Again', password: 'viewer password', nowIso })).rejects.toThrow();

    const revoked = await createInvite({ db, actor: owner.auth, email: 'revoked@example.com', role: 'member', origin: 'https://family.example.test', nowIso });
    db.invites[1]!.revoked_at = nowIso;
    await expect(acceptInvite({ db, token: revoked.rawToken, displayName: 'Nope', password: 'viewer password', nowIso })).rejects.toThrow();
  });

  it('prevents disabling the only owner, revokes sessions, and associates push subscriptions to users', async () => {
    const db = new FakeAuthD1Database();
    const owner = await createOwner(db);

    await expect(setUserStatus(db, owner.auth, owner.auth.user.id, 'disabled', nowIso)).rejects.toThrow();
    await revokeAllSessionsForUser(db, owner.auth.user.id, nowIso);
    expect(db.sessions.every((session) => session.revoked_at !== null)).toBe(true);

    db.pushSubscriptions.push({ endpoint: 'https://push.example.test/one', user_id: null, updated_at: nowIso });
    await associatePushSubscriptionWithUser(db, 'https://push.example.test/one', owner.auth.user.id, nowIso);
    expect(db.pushSubscriptions[0]?.user_id).toBe(owner.auth.user.id);
  });
});

async function expectBootstrapCode(
  db: FakeAuthD1Database,
  overrides: Partial<{ displayName: string; email: string; password: string; bootstrapToken: string }>,
  code: string,
) {
  const response = await callBootstrapRoute(db, overrides);
  const responseText = await response.text();

  expect(response.status).toBe(403);
  expect(responseText).toContain(`"code":"${code}"`);
  expect(responseText).not.toContain(overrides.bootstrapToken ?? 'setup-secret');
  expect(responseText).not.toContain(overrides.password ?? 'family password');
  expect(responseText).not.toContain('pbkdf2-sha256-v1');
}

function callBootstrapRoute(
  db: FakeAuthD1Database,
  overrides: Partial<{ displayName: string; email: string; password: string; bootstrapToken: string }>,
): Promise<Response> {
  const body = {
    displayName: overrides.displayName ?? 'Ido',
    email: overrides.email ?? 'ido@example.com',
    password: overrides.password ?? 'family password',
    bootstrapToken: overrides.bootstrapToken ?? 'setup-secret',
  };

  return handleBootstrapRequest({
    request: new Request('https://family.example.test/api/auth/bootstrap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://family.example.test',
      },
      body: JSON.stringify(body),
    }),
    env: {
      FAMILY_DB: db,
      AUTH_BOOTSTRAP_TOKEN: 'setup-secret',
    },
  });
}

async function createOwner(db: FakeAuthD1Database) {
  return bootstrapFirstOwner({
    db,
    bootstrapToken: 'setup-secret',
    expectedBootstrapToken: 'setup-secret',
    displayName: 'Owner',
    email: 'owner@example.com',
    password: 'family password',
    nowIso,
  });
}

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString();
}

type Row = Record<string, string | number | null>;

class FakeAuthD1Database {
  workspaces: Row[] = [];
  users: Row[] = [];
  memberships: Row[] = [];
  sessions: Row[] = [];
  invites: Row[] = [];
  links: Row[] = [];
  pushSubscriptions: Row[] = [];

  constructor(readonly options: { failOnQueryIncludes?: string } = {}) {}

  prepare(query: string) {
    return new FakeStatement(this, query);
  }
}

class FakeStatement {
  private values: Array<string | number | null> = [];

  constructor(private readonly db: FakeAuthD1Database, private readonly query: string) {}

  bind(...values: Array<string | number | null>) {
    this.values = values;

    return this;
  }

  async all<T>() {
    return { results: this.select() as T[] };
  }

  async first<T>() {
    return (this.select()[0] ?? null) as T | null;
  }

  async run() {
    this.mutate();

    return { meta: { changes: 1 } };
  }

  private select(): Row[] {
    const query = this.query;
    this.throwIfConfiguredFailure();

    if (query.includes('COUNT(*) AS count FROM app_users')) {
      return [{ count: this.db.users.length }];
    }

    if (query.includes("COUNT(*) AS count FROM workspace_memberships WHERE role = 'owner'")) {
      return [{ count: this.db.memberships.filter((item) => item.role === 'owner' && item.status === 'active').length }];
    }

    if (query.includes('FROM app_users WHERE normalized_email')) {
      return this.db.users.filter((item) => item.normalized_email === this.values[0]);
    }

    if (query.includes('FROM app_users WHERE id')) {
      return this.db.users.filter((item) => item.id === this.values[0]);
    }

    if (query.includes('FROM workspaces WHERE id')) {
      return this.db.workspaces.filter((item) => item.id === this.values[0]);
    }

    if (query.includes('FROM workspace_memberships WHERE user_id')) {
      return this.db.memberships.filter((item) => item.user_id === this.values[0] && item.status === this.values[1]);
    }

    if (query.includes('FROM workspace_memberships WHERE workspace_id = ? AND user_id = ? AND role')) {
      return this.db.memberships.filter((item) => item.workspace_id === this.values[0] && item.user_id === this.values[1] && item.role === 'owner');
    }

    if (query.includes('FROM workspace_memberships WHERE workspace_id = ? AND user_id = ?')) {
      return this.db.memberships.filter((item) => item.workspace_id === this.values[0] && item.user_id === this.values[1]);
    }

    if (query.includes('COUNT(*) AS count FROM workspace_memberships m')) {
      return [{
        count: this.db.memberships.filter((item) => item.workspace_id === this.values[0] && item.role === 'owner' && item.status === 'active' && item.user_id !== this.values[1]).length,
      }];
    }

    if (query.includes('FROM auth_sessions WHERE token_hash')) {
      return this.db.sessions.filter((item) => item.token_hash === this.values[0]);
    }

    if (query.includes('FROM auth_invites WHERE token_hash')) {
      return this.db.invites.filter((item) => item.token_hash === this.values[0]);
    }

    if (query.includes('FROM user_schedule_member_links')) {
      return this.db.links.filter((item) => item.workspace_id === this.values[0] && item.user_id === this.values[1]);
    }

    if (query.includes('FROM app_users u JOIN workspace_memberships')) {
      return this.db.memberships
        .filter((membership) => membership.workspace_id === this.values[0])
        .map((membership) => {
          const user = this.db.users.find((candidate) => candidate.id === membership.user_id)!;

          return {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            status: user.status,
            last_login_at: user.last_login_at,
            role: membership.role,
            membership_status: membership.status,
          };
        });
    }

    return [];
  }

  private mutate(): void {
    const query = this.query;
    this.throwIfConfiguredFailure();

    if (query.startsWith('INSERT INTO workspaces')) {
      if (!this.db.workspaces.some((item) => item.id === this.values[0])) {
        this.db.workspaces.push({ id: this.values[0], name: this.values[1], type: this.values[2], created_at: this.values[3], updated_at: this.values[4] });
      }
      return;
    }

    if (query.startsWith('INSERT INTO app_users')) {
      this.db.users.push({
        id: this.values[0],
        email: this.values[1],
        normalized_email: this.values[2],
        display_name: this.values[3],
        password_hash: this.values[4],
        status: this.values[5],
        created_at: this.values[6],
        updated_at: this.values[7],
        last_login_at: null,
      });
      return;
    }

    if (query.startsWith('INSERT INTO workspace_memberships')) {
      const existing = this.db.memberships.find((item) => item.workspace_id === this.values[1] && item.user_id === this.values[2]);
      const row = { id: this.values[0], workspace_id: this.values[1], user_id: this.values[2], role: this.values[3], status: this.values[4], created_at: this.values[5], updated_at: this.values[6] };

      if (existing === undefined) {
        this.db.memberships.push(row);
      } else {
        Object.assign(existing, row);
      }
      return;
    }

    if (query.startsWith('INSERT INTO auth_sessions')) {
      this.db.sessions.push({
        id: this.values[0],
        user_id: this.values[1],
        workspace_id: this.values[2],
        token_hash: this.values[3],
        created_at: this.values[4],
        expires_at: this.values[5],
        last_seen_at: this.values[6],
        revoked_at: null,
      });
      return;
    }

    if (query.startsWith('INSERT INTO auth_invites')) {
      this.db.invites.push({
        id: this.values[0],
        workspace_id: this.values[1],
        email: this.values[2],
        role: this.values[3],
        token_hash: this.values[4],
        created_by_user_id: this.values[5],
        created_at: this.values[6],
        expires_at: this.values[7],
        accepted_at: null,
        revoked_at: null,
      });
      return;
    }

    if (query.startsWith('UPDATE auth_sessions SET revoked_at')) {
      for (const session of this.db.sessions.filter((item) => item.id === this.values[2] || item.user_id === this.values[2])) {
        session.revoked_at = this.values[0];
      }
      return;
    }

    if (query.startsWith('UPDATE auth_sessions SET last_seen_at')) {
      const session = this.db.sessions.find((item) => item.id === this.values[1]);
      if (session !== undefined) {
        session.last_seen_at = this.values[0];
      }
      return;
    }

    if (query.startsWith('UPDATE app_users SET last_login_at')) {
      const user = this.db.users.find((item) => item.id === this.values[2]);
      if (user !== undefined) {
        user.last_login_at = this.values[0];
      }
      return;
    }

    if (query.startsWith('UPDATE app_users SET status')) {
      const user = this.db.users.find((item) => item.id === this.values[2]);
      if (user !== undefined) {
        user.status = this.values[0];
      }
      return;
    }

    if (query.startsWith('UPDATE auth_invites SET accepted_at')) {
      const invite = this.db.invites.find((item) => item.id === this.values[1] && item.accepted_at === null);
      if (invite !== undefined) {
        invite.accepted_at = this.values[0];
      }
      return;
    }

    if (query.startsWith('UPDATE auth_invites SET revoked_at')) {
      const invite = this.db.invites.find((item) => item.id === this.values[1] && item.workspace_id === this.values[2] && item.accepted_at === null);
      if (invite !== undefined) {
        invite.revoked_at = this.values[0];
      }
      return;
    }

    if (query.startsWith('UPDATE push_subscriptions SET user_id')) {
      const subscription = this.db.pushSubscriptions.find((item) => item.endpoint === this.values[2]);
      if (subscription !== undefined) {
        subscription.user_id = this.values[0];
        subscription.updated_at = this.values[1];
      }
    }
  }

  private throwIfConfiguredFailure(): void {
    if (
      this.db.options.failOnQueryIncludes !== undefined &&
      this.query.includes(this.db.options.failOnQueryIncludes)
    ) {
      throw new Error('simulated database failure with forbidden secret-like details');
    }
  }
}
