import {
  assertSameOriginMutation,
  bootstrapFirstOwner,
  buildSessionCookie,
  getDatabase,
  getSafeBootstrapFailureCode,
  getSafeBootstrapFailureLog,
  jsonResponse,
  safeAuthPayload,
} from '../authCore';

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

  if (
    body === null ||
    typeof body.displayName !== 'string' ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string' ||
    typeof body.bootstrapToken !== 'string'
  ) {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  try {
    const result = await bootstrapFirstOwner({
      db,
      displayName: body.displayName,
      email: body.email,
      password: body.password,
      bootstrapToken: body.bootstrapToken,
      expectedBootstrapToken: context.env.AUTH_BOOTSTRAP_TOKEN,
    });

    return jsonResponse(
      { authenticated: true, ...safeAuthPayload(result.auth) },
      200,
      { 'Set-Cookie': buildSessionCookie(result.sessionToken, context.request, result.expiresAt) },
    );
  } catch (error) {
    const code = getSafeBootstrapFailureCode(error);

    if (code !== 'invalid_bootstrap_token' && code !== 'bootstrap_closed' && code !== 'invalid_account_input') {
      console.error('bootstrap failed', getSafeBootstrapFailureLog(error));
    }

    return jsonResponse({ error: 'Initial setup could not be completed.', code }, 403);
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
