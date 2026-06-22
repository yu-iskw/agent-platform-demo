import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mintDelegationJwt } from './delegation-jwt.js';
import { resolveAuthorizedMcpUser } from './resolve-mcp-user.js';

const TEST_SECRET = 'test-delegation-secret-at-least-32-chars';
const EXPECTED_AUDIENCE = 'https://bq-mcp.example.com';

vi.mock('./google-access-token.js', () => ({
  getEmailFromGoogleAccessToken: vi.fn((token: string) => {
    if (token.startsWith('valid-user-token')) {
      return Promise.resolve('user@example.com');
    }
    return Promise.reject(new Error('invalid token'));
  }),
}));

describe('resolveAuthorizedMcpUser', () => {
  beforeEach(() => {
    process.env.DELEGATION_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.DELEGATION_JWT_SECRET;
  });

  it('accepts delegation JWT without Google access token', async () => {
    const delegationToken = await mintDelegationJwt({
      email: 'user@example.com',
      audience: EXPECTED_AUDIENCE,
    });

    const user = await resolveAuthorizedMcpUser(
      { 'x-delegation-token': `Bearer ${delegationToken}` },
      { email: 'remote-agent-sa@example.com', isServiceAccount: true },
      { expectedAudience: EXPECTED_AUDIENCE },
    );

    expect(user).toEqual({
      email: 'user@example.com',
      credentialSource: 'delegation_jwt',
      credentialIssuer: 'remote-agent',
      credentialAudience: EXPECTED_AUDIENCE,
    });
  });

  it('falls back to Google access token passthrough', async () => {
    const user = await resolveAuthorizedMcpUser(
      { 'x-user-access-token': 'valid-user-token' },
      undefined,
      { expectedAudience: EXPECTED_AUDIENCE },
    );

    expect(user).toEqual({
      email: 'user@example.com',
      googleAccessToken: 'valid-user-token',
      credentialSource: 'user_oauth_access_token',
    });
  });
});
