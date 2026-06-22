import { AsyncLocalStorage } from 'node:async_hooks';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createGoogleUserAuthMiddleware,
  type GoogleUserContext,
} from './google-user-auth-middleware.js';

vi.mock('./google-access-token.js', () => ({
  getEmailFromGoogleAccessToken: vi.fn((token: string) => {
    switch (token) {
      case 'valid-token':
        return Promise.resolve('user@example.com');
      default:
        return Promise.reject(new Error('invalid'));
    }
  }),
}));

describe('createGoogleUserAuthMiddleware', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no token is present', async () => {
    const middleware = createGoogleUserAuthMiddleware({});
    const json = vi.fn();
    const next = vi.fn();

    await middleware({ headers: {} }, { status: () => ({ json }) }, next);

    expect(json).toHaveBeenCalledWith({ error: 'Missing Google access token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('validates Authorization bearer locally', async () => {
    const storage = new AsyncLocalStorage<GoogleUserContext>();
    const middleware = createGoogleUserAuthMiddleware({
      userContext: storage,
    });
    const json = vi.fn();
    const next = vi.fn();

    await middleware(
      { headers: { authorization: 'Bearer valid-token' } },
      { status: () => ({ json }) },
      next,
    );

    expect(next).toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('prefers x-session-authorization over authorization', async () => {
    const middleware = createGoogleUserAuthMiddleware({});
    const json = vi.fn();
    const next = vi.fn();

    await middleware(
      {
        headers: {
          authorization: 'Bearer wrong-token',
          'x-session-authorization': 'Bearer valid-token',
        },
      },
      { status: () => ({ json }) },
      next,
    );

    expect(next).toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });

  it('returns 403 for invalid token', async () => {
    const middleware = createGoogleUserAuthMiddleware({});
    const json = vi.fn();
    const next = vi.fn();

    await middleware(
      { headers: { authorization: 'Bearer invalid-token' } },
      { status: () => ({ json }) },
      next,
    );

    expect(json).toHaveBeenCalledWith({ error: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });
});
