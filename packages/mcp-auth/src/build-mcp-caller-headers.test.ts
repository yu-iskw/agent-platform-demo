import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildMcpCallerHeadersForAgent,
  buildMcpCallerHeadersForDirect,
} from './build-mcp-caller-headers.js';

const TEST_SECRET = 'test-delegation-secret-at-least-32-chars';

vi.mock('./service-auth-outbound.js', () => ({
  fetchCloudRunIdToken: vi.fn(() => Promise.resolve('cloud-run-id-token')),
}));

describe('buildMcpCallerHeadersForAgent', () => {
  beforeEach(() => {
    process.env.DELEGATION_JWT_SECRET = TEST_SECRET;
    process.env.AUTH_MODE = 'cloud';
  });

  afterEach(() => {
    delete process.env.DELEGATION_JWT_SECRET;
    delete process.env.AUTH_MODE;
  });

  it('sends delegation JWT instead of Google access token when secret is configured', async () => {
    const headers = await buildMcpCallerHeadersForAgent('https://bq-mcp.example.com/mcp', {
      email: 'user@example.com',
      googleAccessToken: 'google-access-token',
    });

    expect(headers['x-delegation-token']).toMatch(/^Bearer /);
    expect(headers['x-user-access-token']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer cloud-run-id-token');
  });
});

describe('buildMcpCallerHeadersForDirect', () => {
  it('keeps Google passthrough headers for IDE clients', async () => {
    process.env.AUTH_MODE = 'google';

    const headers = await buildMcpCallerHeadersForDirect(
      'http://localhost:8080/mcp',
      'google-access-token',
    );

    expect(headers['x-user-access-token']).toBe('google-access-token');
    expect(headers.Authorization).toBe('Bearer google-access-token');
    expect(headers['x-delegation-token']).toBeUndefined();

    delete process.env.AUTH_MODE;
  });
});
