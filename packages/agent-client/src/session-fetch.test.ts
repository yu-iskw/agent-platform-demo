import { describe, expect, it } from 'vitest';

import { shouldApplyCloudRunAgentAuth } from './session-fetch.js';

describe('shouldApplyCloudRunAgentAuth', () => {
  const agentUrl = 'https://remote-agent-abc.asia-northeast1.run.app';

  it('applies for agent card, api catalog, and agent MCP on the same origin', () => {
    expect(shouldApplyCloudRunAgentAuth(`${agentUrl}/.well-known/agent-card.json`, agentUrl)).toBe(
      true,
    );
    expect(shouldApplyCloudRunAgentAuth(`${agentUrl}/.well-known/api-catalog`, agentUrl)).toBe(
      true,
    );
    expect(
      shouldApplyCloudRunAgentAuth(`${agentUrl}/agents/bigquery/agent-card.json`, agentUrl),
    ).toBe(true);
    expect(shouldApplyCloudRunAgentAuth(`${agentUrl}/mcp`, agentUrl)).toBe(true);
  });

  it('does not apply for bq-mcp proxy or other hosts', () => {
    expect(shouldApplyCloudRunAgentAuth('http://127.0.0.1:8080/mcp', agentUrl)).toBe(false);
    expect(
      shouldApplyCloudRunAgentAuth('https://bq-mcp-xyz.asia-northeast1.run.app/mcp', agentUrl),
    ).toBe(false);
  });

  it('does not apply when agent is local', () => {
    expect(
      shouldApplyCloudRunAgentAuth(
        'http://127.0.0.1:8081/.well-known/agent-card.json',
        'http://127.0.0.1:8081',
      ),
    ).toBe(false);
  });
});
