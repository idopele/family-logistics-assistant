import {
  assertSameOriginMutation,
  authenticateRequest,
  getDatabase,
  jsonResponse,
  type AuthEnv,
  type AuthenticatedSession,
} from './authCore';

export type GuardedContext<TEnv extends AuthEnv = AuthEnv> = {
  request: Request;
  env: TEnv;
};

export async function requireAppSession<TEnv extends AuthEnv>(
  context: GuardedContext<TEnv>,
): Promise<{ auth: AuthenticatedSession } | Response> {
  const db = getDatabase(context.env);

  if (db === null) {
    return jsonResponse({ error: 'Shared data is not configured.' }, 503);
  }

  try {
    assertSameOriginMutation(context.request);
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 403);
  }

  const auth = await authenticateRequest(db, context.request);

  if (auth === null) {
    return jsonResponse({ error: 'Authentication required.' }, 401);
  }

  return { auth };
}
