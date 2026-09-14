import { handleGetSharedState, handleMutateSharedState } from './sharedData';
import { requireAppSession } from './authGuard';

export async function onRequestGet(context: Parameters<typeof handleGetSharedState>[0]): Promise<Response> {
  const guard = await requireAppSession(context);

  return guard instanceof Response ? guard : handleGetSharedState(context, guard.auth);
}

export async function onRequestPost(context: Parameters<typeof handleMutateSharedState>[0]): Promise<Response> {
  const guard = await requireAppSession(context);

  return guard instanceof Response ? guard : handleMutateSharedState(context, guard.auth);
}
