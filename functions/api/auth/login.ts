import { assertSameOriginMutation, buildSessionCookie, getDatabase, jsonResponse, loginUser, safeAuthPayload } from '../authCore';

type PagesContext = {
  request: Request;
  env: Parameters<typeof getDatabase>[0];
};

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const db = getDatabase(context.env);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  try {
    assertSameOriginMutation(context.request);
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 403);
  }

  const body = await readJson(context.request);

  if (body === null || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const result = await loginUser({ db, email: body.email, password: body.password });

  if (result === null) {
    return jsonResponse({ error: 'The sign-in details are incorrect.' }, 401);
  }

  return jsonResponse(
    { authenticated: true, ...safeAuthPayload(result.auth) },
    200,
    { 'Set-Cookie': buildSessionCookie(result.sessionToken, context.request, result.expiresAt) },
  );
}

async function readJson(request: Request): Promise<{ email?: unknown; password?: unknown } | null> {
  try {
    return (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return null;
  }
}
