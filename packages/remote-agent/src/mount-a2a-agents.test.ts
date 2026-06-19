import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { initAgentPolicy, setAgentEnabled } from './agent-policy.js';
import { mountA2aAgents } from './mount-a2a-agents.js';

import type { Server } from 'node:http';

const BASE_URL = 'http://localhost:9999';

function mountTestApp(): express.Express {
  const app = express();
  initAgentPolicy(BASE_URL);
  mountA2aAgents(app, {
    publicBaseUrl: BASE_URL,
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
  afterEach(() => {
    initAgentPolicy(BASE_URL);
  });

  it('serves enabled per-agent cards without legacy root intercepting other agents', async () => {
    const app = mountTestApp();
    setAgentEnabled('bigquery', false);
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
