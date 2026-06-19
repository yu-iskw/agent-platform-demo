import { createAgentPolicyStore } from '@agent-platform/a2a-server';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';

import { getAgentDefinitions } from './agent-definitions.js';
import { mountAgentMcpRoutes } from './mcp-routes.js';

import type { Server } from 'node:http';

vi.mock('./agent.js', () => ({
  runBigQueryAgentPrompt: vi.fn(),
}));

const PUBLIC_BASE_URL = 'http://localhost:8081';

async function listen(
  app: express.Express,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => {
      resolve(listening);
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

describe('mountAgentMcpRoutes', () => {
  it('returns 404 when BigQuery agent is disabled', async () => {
    const definitions = getAgentDefinitions();
    const policy = createAgentPolicyStore(definitions, PUBLIC_BASE_URL);
    policy.setEnabled('bigquery', false);

    const app = express();
    mountAgentMcpRoutes(app, {
      mcpResourceUrl: `${PUBLIC_BASE_URL}/mcp`,
      policy,
    });

    const { baseUrl, close } = await listen(app);

    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.1.0' },
          },
        }),
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'Agent disabled' });
    } finally {
      await close();
    }
  });
});
