import { afterEach, describe, expect, it } from 'vitest';

import {
  getEnabledAgentDefinitions,
  initAgentPolicy,
  isAgentEnabled,
  listAgentPolicy,
  setAgentEnabled,
} from './agent-policy.js';

const BASE_URL = 'https://example.run.app';

describe('agent-policy', () => {
  afterEach(() => {
    initAgentPolicy(BASE_URL);
  });

  it('enables all agents at startup', () => {
    initAgentPolicy(BASE_URL);

    expect(listAgentPolicy().every((agent) => agent.enabled)).toBe(true);
    expect(getEnabledAgentDefinitions().map((agent) => agent.id)).toEqual(['bigquery', 'general']);
  });

  it('updates enabled state at runtime', () => {
    initAgentPolicy(BASE_URL);

    setAgentEnabled('general', false);

    expect(isAgentEnabled('general')).toBe(false);
    expect(listAgentPolicy().find((agent) => agent.id === 'general')?.enabled).toBe(false);
  });

  it('rejects unknown agent ids', () => {
    initAgentPolicy(BASE_URL);

    expect(() => {
      setAgentEnabled('unknown', true);
    }).toThrow(/Unknown agent/);
  });
});
