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
    return jsonResponse({ users: await listWorkspaceUsers(db, guard.auth) });
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
      default:
        return jsonResponse({ error: 'Invalid request.' }, 400);
    }
  } catch {
    return jsonResponse({ error: 'Not authorized.' }, 403);
  }
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
