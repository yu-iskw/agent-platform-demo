import { describe, expect, it } from 'vitest';

import { looksLikeBigQueryRequest, resolveChatAgentId } from './resolve-chat-agent-id.js';

describe('looksLikeBigQueryRequest', () => {
  it('detects dataset listing prompts', () => {
    expect(looksLikeBigQueryRequest('List datasets in my-gcp-project')).toBe(true);
    expect(looksLikeBigQueryRequest('Can you access BigQuery?')).toBe(true);
  });

  it('ignores general chat', () => {
    expect(looksLikeBigQueryRequest('Hello there')).toBe(false);
  });
});

describe('resolveChatAgentId', () => {
  const policy = [
    { id: 'bigquery', enabled: true },
    { id: 'general', enabled: true },
  ];

  it('routes BigQuery prompts to bigquery when enabled even if general is selected', () => {
    expect(resolveChatAgentId('List datasets in my-gcp-project', 'general', policy)).toEqual({
      agentId: 'bigquery',
      routed: true,
    });
  });

  it('keeps general for non-BigQuery prompts when general is selected', () => {
    expect(resolveChatAgentId('Say hi', 'general', policy)).toEqual({
      agentId: 'general',
      routed: false,
    });
  });

  it('falls back to an enabled agent when the selection is disabled', () => {
    const disabledSelection = [
      { id: 'bigquery', enabled: true },
      { id: 'general', enabled: false },
    ];
    expect(resolveChatAgentId('Say hi', 'general', disabledSelection)).toEqual({
      agentId: 'bigquery',
      routed: true,
    });
  });

  it('throws when no agents are enabled', () => {
    expect(() =>
      resolveChatAgentId('Say hi', 'general', [
        { id: 'bigquery', enabled: false },
        { id: 'general', enabled: false },
      ]),
    ).toThrow(/not enabled or not available/);
  });
});
