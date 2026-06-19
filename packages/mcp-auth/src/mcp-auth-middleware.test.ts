import { describe, expect, it } from 'vitest';

import { resolvePrmResourceUrl } from './mcp-auth-middleware.js';

describe('resolvePrmResourceUrl', () => {
  const fallback = 'https://bq-mcp.example.run.app/mcp';

  it('uses X-Forwarded-Host from gcloud-style proxy', () => {
    expect(
      resolvePrmResourceUrl(
        {
          host: 'bq-mcp.example.run.app',
          'x-forwarded-host': '127.0.0.1:8080',
          'x-forwarded-proto': 'http',
        },
        fallback,
      ),
    ).toBe('http://127.0.0.1:8080/mcp');
  });

  it('uses Host when client connects directly to localhost', () => {
    expect(
      resolvePrmResourceUrl(
        {
          host: '127.0.0.1:8080',
        },
        fallback,
      ),
    ).toBe('http://127.0.0.1:8080/mcp');
  });

  it('uses http for localhost even when Cloud Run sets x-forwarded-proto=https', () => {
    expect(
      resolvePrmResourceUrl(
        {
          host: 'bq-mcp.example.run.app',
          'x-forwarded-host': '127.0.0.1:8080',
          'x-forwarded-proto': 'https',
        },
        fallback,
      ),
    ).toBe('http://127.0.0.1:8080/mcp');
  });

  it('falls back to MCP_RESOURCE_URL for Cloud Run host only', () => {
    expect(
      resolvePrmResourceUrl(
        {
          host: 'bq-mcp.example.run.app',
        },
        fallback,
      ),
    ).toBe(fallback);
  });
});
