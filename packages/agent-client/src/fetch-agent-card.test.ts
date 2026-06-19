import { describe, expect, it } from 'vitest';

import {
  fetchAgentCardAt,
  fetchAgentCardForHost,
  resolveAgentCardPath,
  resolveAgentCardUrl,
  validateAgentId,
} from './fetch-agent-card.js';

describe('resolveAgentCardPath', () => {
  it('uses agent-card.json for path-prefixed multi-agent URLs', () => {
    expect(resolveAgentCardPath('https://example.run.app/agents/bigquery')).toBe('agent-card.json');
    expect(resolveAgentCardPath('https://example.run.app/agents/general/')).toBe('agent-card.json');
  });

  it('uses well-known path for service root URLs', () => {
    expect(resolveAgentCardPath('https://example.run.app')).toBe('.well-known/agent-card.json');
    expect(resolveAgentCardPath('http://127.0.0.1:8081')).toBe('.well-known/agent-card.json');
  });
});

describe('resolveAgentCardUrl', () => {
  it('builds the card URL for multi-agent paths', () => {
    expect(resolveAgentCardUrl('https://example.run.app/agents/bigquery')).toBe(
      'https://example.run.app/agents/bigquery/agent-card.json',
    );
  });

  it('builds the legacy well-known card URL for service root', () => {
    expect(resolveAgentCardUrl('https://example.run.app')).toBe(
      'https://example.run.app/.well-known/agent-card.json',
    );
  });
});

describe('validateAgentId', () => {
  it('accepts slug ids', () => {
    expect(validateAgentId('bigquery')).toBe('bigquery');
  });

  it('rejects invalid ids', () => {
    expect(() => validateAgentId('../evil')).toThrow(/Invalid agent id/);
  });
});

describe('fetchAgentCardForHost', () => {
  it('rejects disallowed card URL hosts', async () => {
    await expect(fetchAgentCardForHost('https://evil.example.com', 'bigquery')).rejects.toThrow(
      /not allowed/,
    );
  });
});

describe('fetchAgentCardAt', () => {
  it('rejects disallowed card URL hosts', async () => {
    await expect(
      fetchAgentCardAt('https://evil.example.com/agents/bigquery/agent-card.json'),
    ).rejects.toThrow(/not allowed/);
  });
});
