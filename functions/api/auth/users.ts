import {
  associatePushSubscriptionWithUser,
  createInvite,
  getDatabase,
  jsonResponse,
  listWorkspaceUsers,
  revokeAllSessionsForUser,
  revokeUnusedInvite,
  setUserStatus,
  type AuthRole,
  type AuthUserStatus,
} from '../authCore';
import { requireAppSession } from '../authGuard';
import type { EventCategory, PermissionScope } from '../../../src/models';

type PagesContext = {
  request: Request;
  env: Parameters<typeof getDatabase>[0];
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const guard = await requireAppSession(context);

  if (guard instanceof Response) {
    return guard;
  }

  const db = getDatabase(context.env);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  try {
    return jsonResponse({
      users: await listWorkspaceUsers(db, guard.auth),
      sharedViews: await listSharedViews(db, guard.auth),
    });
  } catch {
    return jsonResponse({ error: 'Not authorized.' }, 403);
  }
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const guard = await requireAppSession(context);

  if (guard instanceof Response) {
    return guard;
  }

  const db = getDatabase(context.env);
  const body = await readJson(context.request);

  if (db === null || body === null || typeof body.action !== 'string') {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  try {
    switch (body.action) {
      case 'createInvite': {
        if (typeof body.email !== 'string' || !isInviteRole(body.role)) {
          return jsonResponse({ error: 'Invalid request.' }, 400);
        }

        const invite = await createInvite({
          db,
          actor: guard.auth,
          email: body.email,
          role: body.role,
          origin: new URL(context.request.url).origin,
        });

        return jsonResponse({ invite: invite.invite, inviteUrl: invite.inviteUrl });
      }
      case 'setUserStatus': {
        if (typeof body.userId !== 'string' || !isUserStatus(body.status)) {
          return jsonResponse({ error: 'Invalid request.' }, 400);
        }

        await setUserStatus(db, guard.auth, body.userId, body.status);

        return jsonResponse({ ok: true });
      }
      case 'revokeSessions': {
        if (typeof body.userId !== 'string') {
          return jsonResponse({ error: 'Invalid request.' }, 400);
        }

        await revokeAllSessionsForUser(db, body.userId);

        return jsonResponse({ ok: true });
      }
      case 'revokeInvite': {
        if (typeof body.inviteId !== 'string') {
          return jsonResponse({ error: 'Invalid request.' }, 400);
        }

        await revokeUnusedInvite(db, guard.auth, body.inviteId);

        return jsonResponse({ ok: true });
      }
      case 'claimPushSubscription': {
        if (typeof body.endpoint !== 'string') {
          return jsonResponse({ error: 'Invalid request.' }, 400);
        }

        await associatePushSubscriptionWithUser(db, body.endpoint, guard.auth.user.id);

        return jsonResponse({ ok: true });
      }
      case 'saveSharedView': {
        if (!isSharedViewInput(body.view)) {
          return jsonResponse({ error: 'Invalid request.' }, 400);
        }

        await saveSharedView(db, guard.auth, body.view);

        return jsonResponse({ ok: true });
      }
      default:
        return jsonResponse({ error: 'Invalid request.' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Not authorized.' }, 403);
  }
}

interface SharedViewInput {
  id?: string;
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

async function listSharedViews(db: NonNullable<ReturnType<typeof getDatabase>>, actor: { workspace: { id: string }; membership: { role: AuthRole } }) {
  if (actor.membership.role !== 'owner' && actor.membership.role !== 'admin') {
    throw new Error('forbidden');
  }

  const { results = [] } = await db
    .prepare('SELECT id, name, description, active, all_schedule_members, all_categories FROM shared_views WHERE workspace_id = ? ORDER BY name')
    .bind(actor.workspace.id)
    .all<{ id: string; name: string; description: string | null; active: number; all_schedule_members: number; all_categories: number }>();

  const views = [];

  for (const row of results) {
    const [userIds, memberIds, categories, permissions] = await Promise.all([
      listSharedViewColumn(db, 'shared_view_users', 'user_id', row.id),
      listSharedViewColumn(db, 'shared_view_schedule_members', 'schedule_member_id', row.id),
      listSharedViewColumn(db, 'shared_view_categories', 'category', row.id),
      listSharedViewColumn(db, 'shared_view_permissions', 'permission', row.id),
    ]);

    views.push({
      id: row.id,
      name: row.name,
      description: row.description,
      active: row.active === 1,
      allMembers: row.all_schedule_members === 1,
      allCategories: row.all_categories === 1,
      userIds,
      memberIds,
      categories,
      permissions,
    });
  }

  return views;
}

async function saveSharedView(
  db: NonNullable<ReturnType<typeof getDatabase>>,
  actor: { user: { id: string }; workspace: { id: string }; membership: { role: AuthRole } },
  view: SharedViewInput,
) {
  if (actor.membership.role !== 'owner' && actor.membership.role !== 'admin') {
    throw new Error('forbidden');
  }

  const nowIso = new Date().toISOString();
  const id = view.id?.trim() !== '' && view.id !== undefined ? view.id : `shared-view-${crypto.randomUUID()}`;

  await db
    .prepare(
      'INSERT INTO shared_views (id, workspace_id, name, description, all_schedule_members, all_categories, active, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, all_schedule_members = excluded.all_schedule_members, all_categories = excluded.all_categories, active = excluded.active, updated_at = excluded.updated_at',
    )
    .bind(
      id,
      actor.workspace.id,
      view.name.trim(),
      view.description,
      view.allMembers ? 1 : 0,
      view.allCategories ? 1 : 0,
      view.active ? 1 : 0,
      actor.user.id,
      nowIso,
      nowIso,
    )
    .run();

  await db.prepare('DELETE FROM shared_view_users WHERE shared_view_id = ?').bind(id).run();
  await db.prepare('DELETE FROM shared_view_schedule_members WHERE shared_view_id = ?').bind(id).run();
  await db.prepare('DELETE FROM shared_view_categories WHERE shared_view_id = ?').bind(id).run();
  await db.prepare('DELETE FROM shared_view_permissions WHERE shared_view_id = ?').bind(id).run();

  for (const userId of view.userIds) {
    await db.prepare('INSERT INTO shared_view_users (id, shared_view_id, user_id, created_at) VALUES (?, ?, ?, ?)').bind(`shared-view-user-${crypto.randomUUID()}`, id, userId, nowIso).run();
  }

  if (!view.allMembers) {
    for (const memberId of view.memberIds) {
      await db.prepare('INSERT INTO shared_view_schedule_members (shared_view_id, schedule_member_id) VALUES (?, ?)').bind(id, memberId).run();
    }
  }

  if (!view.allCategories) {
    for (const category of view.categories) {
      await db.prepare('INSERT INTO shared_view_categories (shared_view_id, category) VALUES (?, ?)').bind(id, category).run();
    }
  }

  for (const permission of view.permissions) {
    await db.prepare('INSERT INTO shared_view_permissions (shared_view_id, permission) VALUES (?, ?)').bind(id, permission).run();
  }
}

async function listSharedViewColumn(db: NonNullable<ReturnType<typeof getDatabase>>, table: string, column: string, sharedViewId: string): Promise<string[]> {
  const { results = [] } = await db
    .prepare(`SELECT ${column} AS value FROM ${table} WHERE shared_view_id = ? ORDER BY ${column}`)
    .bind(sharedViewId)
    .all<{ value: string }>();

  return results.map((row) => row.value);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isInviteRole(value: unknown): value is Exclude<AuthRole, 'owner'> {
  return value === 'admin' || value === 'member' || value === 'viewer';
}

function isUserStatus(value: unknown): value is AuthUserStatus {
  return value === 'active' || value === 'disabled';
}

function isSharedViewInput(value: unknown): value is SharedViewInput {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const view = value as Partial<SharedViewInput>;

  return (
    (typeof view.id === 'string' || view.id === undefined) &&
    typeof view.name === 'string' &&
    view.name.trim() !== '' &&
    (typeof view.description === 'string' || view.description === null) &&
    typeof view.active === 'boolean' &&
    typeof view.allMembers === 'boolean' &&
    typeof view.allCategories === 'boolean' &&
    Array.isArray(view.userIds) &&
    view.userIds.every((id) => typeof id === 'string' && id.trim() !== '') &&
    Array.isArray(view.memberIds) &&
    view.memberIds.every((id) => typeof id === 'string' && id.trim() !== '') &&
    Array.isArray(view.categories) &&
    view.categories.every(isEventCategory) &&
    Array.isArray(view.permissions) &&
    view.permissions.every(isSharedViewPermission)
  );
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === 'string';
}

function isSharedViewPermission(value: unknown): value is PermissionScope {
  return (
    value === 'view_schedule' ||
    value === 'edit_schedule' ||
    value === 'view_transportation' ||
    value === 'edit_transportation' ||
    value === 'view_contacts' ||
    value === 'receive_notifications'
  );
}
