import express from 'express';
import { describe, expect, it } from 'vitest';

import { createAgentPolicyStore } from './agent-policy-store.js';
import { mountA2aAgents } from './mount-a2a-agents.js';
import { testDefinitions } from './test-fixtures.js';

import type { Server } from 'node:http';

const MOUNT_TEST_BASE_URL = 'http://localhost:9999';

function mountTestApp(policy: ReturnType<typeof createAgentPolicyStore>): express.Express {
  const app = express();
  mountA2aAgents(app, {
    publicBaseUrl: MOUNT_TEST_BASE_URL,
    definitions: testDefinitions,
    policy,
    authMiddleware: (_req, _res, next) => {
      next();
    },
  });
  return app;
}

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

describe('mountA2aAgents', () => {
  it('serves enabled per-agent cards without legacy root intercepting other agents', async () => {
    const policy = createAgentPolicyStore(testDefinitions, MOUNT_TEST_BASE_URL);
    policy.setEnabled('bigquery', false);
    const app = mountTestApp(policy);
    const { baseUrl, close } = await listen(app);

    try {
      const generalCard = await fetch(`${baseUrl}/agents/general/agent-card.json`);
      expect(generalCard.status).toBe(200);

      const bigqueryCard = await fetch(`${baseUrl}/agents/bigquery/agent-card.json`);
      expect(bigqueryCard.status).toBe(404);
      expect(await bigqueryCard.json()).toEqual({ error: 'Agent disabled' });

      const legacyCard = await fetch(`${baseUrl}/.well-known/agent-card.json`);
      expect(legacyCard.status).toBe(404);
    } finally {
      await close();
    }
  });
});
