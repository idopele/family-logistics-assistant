import { handleGetSharedState, handleMutateSharedState } from './sharedData';

export const onRequestGet = handleGetSharedState;
export const onRequestPost = handleMutateSharedState;
