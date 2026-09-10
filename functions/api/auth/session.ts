import { authenticateRequest, getDatabase, jsonResponse, safeAuthPayload } from '../authCore';

type PagesContext = {
  request: Request;
  env: Parameters<typeof getDatabase>[0];
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const db = getDatabase(context.env);

  if (db === null) {
    return jsonResponse({ authenticated: false, setupRequired: false }, 503);
  }

  const auth = await authenticateRequest(db, context.request);

  if (auth !== null) {
    return jsonResponse({ authenticated: true, setupRequired: false, ...safeAuthPayload(auth) });
  }

  const setupRequired = await isSetupRequired(db);

  return jsonResponse({ authenticated: false, setupRequired });
}

async function isSetupRequired(db: NonNullable<ReturnType<typeof getDatabase>>): Promise<boolean> {
  try {
    const row = await db.prepare('SELECT COUNT(*) AS count FROM app_users').first<{ count: number }>();

    return (row?.count ?? 0) === 0;
  } catch {
    return false;
  }
}
