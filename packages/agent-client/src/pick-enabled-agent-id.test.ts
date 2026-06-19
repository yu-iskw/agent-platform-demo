import { describe, expect, it } from 'vitest';

import { pickEnabledAgentId } from './pick-enabled-agent-id.js';

describe('pickEnabledAgentId', () => {
  const policy = [
    { id: 'bigquery', enabled: false },
    { id: 'general', enabled: true },
  ];

  it('does not keep a disabled agent when stale discovery still lists it', () => {
    const discovered = [{ id: 'bigquery' }, { id: 'general' }];
    expect(pickEnabledAgentId('bigquery', discovered, policy)).toBe('general');
  });

  it('keeps the current agent when it is enabled in policy and discovered', () => {
    const discovered = [{ id: 'general' }];
    expect(pickEnabledAgentId('general', discovered, policy)).toBe('general');
  });

  it('falls back to policy when discovery is empty', () => {
    expect(pickEnabledAgentId('bigquery', [], policy)).toBe('general');
  });

  it('uses discovery when policy is not loaded yet', () => {
    const discovered = [{ id: 'bigquery' }, { id: 'general' }];
    expect(pickEnabledAgentId('bigquery', discovered, [])).toBe('bigquery');
  });
});
