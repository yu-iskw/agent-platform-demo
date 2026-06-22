import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DELEGATION_JWT_ISSUER, mintDelegationJwt, verifyDelegationJwt } from './delegation-jwt.js';

const TEST_SECRET = 'test-delegation-secret-at-least-32-chars';

describe('delegation-jwt', () => {
  beforeEach(() => {
    process.env.DELEGATION_JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.DELEGATION_JWT_SECRET;
    vi.useRealTimers();
  });

  it('mints and verifies a delegation JWT', async () => {
    const token = await mintDelegationJwt({
      email: 'User@Example.com',
      audience: 'https://bq-mcp-abc.run.app/mcp',
    });

    const claims = await verifyDelegationJwt(token, {
      expectedAudience: 'https://bq-mcp-abc.run.app',
    });

    expect(claims).toEqual({
      email: 'user@example.com',
      audience: 'https://bq-mcp-abc.run.app',
      issuer: DELEGATION_JWT_ISSUER,
    });
  });

  it('rejects wrong audience', async () => {
    const token = await mintDelegationJwt({
      email: 'user@example.com',
      audience: 'https://bq-mcp-a.run.app',
    });

    await expect(
      verifyDelegationJwt(token, { expectedAudience: 'https://bq-mcp-b.run.app' }),
    ).rejects.toThrow();
  });

  it('rejects expired token', async () => {
    vi.useFakeTimers();
    const token = await mintDelegationJwt({
      email: 'user@example.com',
      audience: 'https://bq-mcp-abc.run.app',
    });

    vi.advanceTimersByTime(6 * 60 * 1000);

    await expect(
      verifyDelegationJwt(token, { expectedAudience: 'https://bq-mcp-abc.run.app' }),
    ).rejects.toThrow();
  });

  it('throws when secret is missing', async () => {
    delete process.env.DELEGATION_JWT_SECRET;

    await expect(
      mintDelegationJwt({ email: 'user@example.com', audience: 'https://bq-mcp.run.app' }),
    ).rejects.toThrow('DELEGATION_JWT_SECRET is not configured');
  });
});
