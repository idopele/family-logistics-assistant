import { acceptInvite, assertSameOriginMutation, buildSessionCookie, getDatabase, jsonResponse, readInviteByToken, safeAuthPayload } from '../authCore';

type PagesContext = {
  request: Request;
  env: Parameters<typeof getDatabase>[0];
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const db = getDatabase(context.env);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  try {
    assertSameOriginMutation(context.request);
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 403);
  }

  const token = new URL(context.request.url).searchParams.get('token');

  if (token === null || token.trim() === '') {
    return jsonResponse({ valid: false }, 400);
  }

  const invite = await readInviteByToken(db, token);

  if (invite === null) {
    return jsonResponse({ valid: false }, 404);
  }

  return jsonResponse({
    valid: true,
    invite: {
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
    },
  });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const db = getDatabase(context.env);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  const body = await readJson(context.request);

  if (body === null || typeof body.token !== 'string' || typeof body.displayName !== 'string' || typeof body.password !== 'string') {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  try {
    const result = await acceptInvite({ db, token: body.token, displayName: body.displayName, password: body.password });

    return jsonResponse(
      { authenticated: true, ...safeAuthPayload(result.auth) },
      200,
      { 'Set-Cookie': buildSessionCookie(result.sessionToken, context.request, result.expiresAt) },
    );
  } catch {
    return jsonResponse({ error: 'Invite could not be accepted.' }, 403);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
