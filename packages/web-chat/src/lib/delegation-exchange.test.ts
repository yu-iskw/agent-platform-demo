import { describe, expect, it } from 'vitest';

import { isDelegationExchangeAvailable } from './delegation-exchange.js';

describe('isDelegationExchangeAvailable', () => {
  it('returns true when DELEGATION_JWT_EXCHANGE is true', () => {
    process.env.DELEGATION_JWT_EXCHANGE = 'true';
    expect(isDelegationExchangeAvailable()).toBe(true);
    delete process.env.DELEGATION_JWT_EXCHANGE;
  });

  it('returns false when unset', () => {
    delete process.env.DELEGATION_JWT_EXCHANGE;
    expect(isDelegationExchangeAvailable()).toBe(false);
  });
});
