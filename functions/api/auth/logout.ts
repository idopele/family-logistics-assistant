import { buildExpiredSessionCookie, getDatabase, jsonResponse, revokeSession } from '../authCore';
import { requireAppSession } from '../authGuard';

type PagesContext = {
  request: Request;
  env: Parameters<typeof getDatabase>[0];
};

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const guard = await requireAppSession(context);

  if (guard instanceof Response) {
    return guard;
  }

  const db = getDatabase(context.env);

  if (db !== null) {
    await revokeSession(db, guard.auth.sessionId);
  }

  return jsonResponse({ ok: true }, 200, { 'Set-Cookie': buildExpiredSessionCookie(context.request) });
}
