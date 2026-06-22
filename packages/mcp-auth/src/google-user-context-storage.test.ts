import { describe, expect, it } from 'vitest';

import { createGoogleUserContextStorage } from './google-user-context-storage.js';

describe('createGoogleUserContextStorage', () => {
  it('throws when no context is active', () => {
    const { getVerifiedGoogleUser } = createGoogleUserContextStorage();

    expect(() => getVerifiedGoogleUser()).toThrow(/Missing verified Google user context/);
  });

  it('returns the active context inside storage.run', async () => {
    const { storage, getVerifiedGoogleUser } = createGoogleUserContextStorage();
    const user = {
      email: 'user@example.com',
      googleAccessToken: 'token',
      credentialSource: 'user_oauth_access_token' as const,
    };

    await storage.run(user, () => {
      expect(getVerifiedGoogleUser()).toEqual(user);
      return Promise.resolve();
    });
  });
});
