import { afterEach, describe, expect, it } from 'vitest';

import { createAgentPolicyStore } from './agent-policy-store.js';
import { TEST_BASE_URL, testDefinitions } from './test-fixtures.js';

describe('createAgentPolicyStore', () => {
  let policy = createAgentPolicyStore(testDefinitions, TEST_BASE_URL);

  afterEach(() => {
    policy = createAgentPolicyStore(testDefinitions, TEST_BASE_URL);
  });

  it('enables all agents at startup', () => {
    expect(policy.list().every((agent) => agent.enabled)).toBe(true);
    expect(policy.getEnabledDefinitions().map((agent) => agent.id)).toEqual([
      'bigquery',
      'general',
    ]);
  });

  it('updates enabled state at runtime', () => {
    policy.setEnabled('general', false);

    expect(policy.isEnabled('general')).toBe(false);
    expect(policy.list().find((agent) => agent.id === 'general')?.enabled).toBe(false);
  });

  it('rejects unknown agent ids', () => {
    expect(() => {
      policy.setEnabled('unknown', true);
    }).toThrow(/Unknown agent/);
  });
});
