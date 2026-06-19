import { AsyncLocalStorage } from 'node:async_hooks';

import type { GoogleUserContext } from './google-user-auth-middleware.js';

export type GoogleUserContextStorage = {
  storage: AsyncLocalStorage<GoogleUserContext>;
  getVerifiedGoogleUser: () => GoogleUserContext;
};

export function createGoogleUserContextStorage(): GoogleUserContextStorage {
  const storage = new AsyncLocalStorage<GoogleUserContext>();

  return {
    storage,
    getVerifiedGoogleUser(): GoogleUserContext {
      const context = storage.getStore();
      if (!context) {
        throw new Error('Missing verified Google user context');
      }

      return context;
    },
  };
}
