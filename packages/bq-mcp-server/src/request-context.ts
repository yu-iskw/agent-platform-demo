import { AsyncLocalStorage } from 'node:async_hooks';

import type { GoogleUserContext } from '@agent-platform/mcp-auth';

export const verifiedUserStorage = new AsyncLocalStorage<GoogleUserContext>();

export function getVerifiedGoogleUser(): GoogleUserContext {
  const context = verifiedUserStorage.getStore();
  if (!context) {
    throw new Error('Missing verified Google user context');
  }

  return context;
}
