import { describe, expect, it } from 'vitest';

import { parseAgentPolicyResponse } from './agent-policy.js';

describe('parseAgentPolicyResponse', () => {
  it('parses a valid policy response', () => {
    expect(
      parseAgentPolicyResponse({
        agents: [
          {
            id: 'bigquery',
            name: 'BigQuery Assistant',
            description: 'Helps list datasets',
            enabled: true,
          },
          {
            id: 'general',
            name: 'General Assistant',
            description: 'Plain chat',
            enabled: false,
          },
        ],
      }),
    ).toEqual([
      {
        id: 'bigquery',
        name: 'BigQuery Assistant',
        description: 'Helps list datasets',
        enabled: true,
      },
      {
        id: 'general',
        name: 'General Assistant',
        description: 'Plain chat',
        enabled: false,
      },
    ]);
  });

  it('rejects malformed responses', () => {
    expect(() => {
      parseAgentPolicyResponse({});
    }).toThrow(/missing agents/);
    expect(() => {
      parseAgentPolicyResponse({ agents: [{ id: 'bigquery' }] });
    }).toThrow(/Invalid agent policy entry/);
  });
});
