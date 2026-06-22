import {
  authRouteRateLimit,
  createMcpSessionRegistry,
  INVALID_SESSION_RESPONSE,
  mountMcpOAuthRoutes,
  runAuthorizedMcpRequest,
} from '@agent-platform/mcp-auth';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { runBigQueryAgentPrompt } from './agent.js';
import { verifiedUserStorage } from './user-context.js';

import type { AgentPolicyStore } from '@agent-platform/a2a-server';
import type { Application, Request, Response } from 'express';

const BIGQUERY_AGENT_ID = 'bigquery';

export function mountAgentMcpRoutes(
  app: Application,
  options: { mcpResourceUrl: string; policy: AgentPolicyStore },
): void {
  const { policy } = options;
  const sessionRegistry = createMcpSessionRegistry({
    createMcpServer: () => createBigQueryMcpServer(),
  });

  function respondAgentDisabled(res: Response): void {
    res.status(404).json({ error: 'Agent disabled' });
  }

  function isBigQueryEnabled(): boolean {
    return policy.isEnabled(BIGQUERY_AGENT_ID);
  }

  async function handleSessionTransportRequest(req: Request, res: Response): Promise<void> {
    if (!isBigQueryEnabled()) {
      respondAgentDisabled(res);
      return;
    }

    await runAuthorizedMcpRequest(req, res, {
      sessionRegistry,
      allowInitialize: false,
      onMissingUserToken: () => res.status(401).end('Missing Google access token'),
      onInvalidUserToken: () => res.status(403).end('Invalid or forbidden user access token'),
      onInvalidSession: () => res.status(400).end(INVALID_SESSION_RESPONSE),
      handle: async (transport, user) => {
        await verifiedUserStorage.run(user, async () => {
          await transport.handleRequest(req, res);
        });
      },
    });
  }

  mountMcpOAuthRoutes(app, {
    mcpResourceUrl: options.mcpResourceUrl,
  });

  app.post('/mcp', authRouteRateLimit, async (req, res) => {
    if (!isBigQueryEnabled()) {
      respondAgentDisabled(res);
      return;
    }

    await runAuthorizedMcpRequest(req, res, {
      sessionRegistry,
      allowInitialize: true,
      onMissingUserToken: () => res.status(401).json({ error: 'Missing Google access token' }),
      onInvalidUserToken: () =>
        res.status(403).json({ error: 'Invalid or forbidden user access token' }),
      handle: async (transport, user) => {
        await verifiedUserStorage.run(user, async () => {
          await transport.handleRequest(req, res, req.body);
        });
      },
    });
  });

  app.get('/mcp', authRouteRateLimit, (req, res) => {
    void handleSessionTransportRequest(req, res);
  });

  app.delete('/mcp', authRouteRateLimit, (req, res) => {
    void handleSessionTransportRequest(req, res);
  });
}

function createBigQueryMcpServer(): McpServer {
  const server = new McpServer({
    name: 'remote-agent',
    version: '0.1.0',
  });

  server.registerTool(
    'chat',
    {
      title: 'Chat with BigQuery assistant',
      description:
        'Send a natural-language message to the ADK agent; it orchestrates BigQuery tools via bq-mcp',
      inputSchema: {
        message: z.string().describe('User message for the BigQuery assistant'),
      },
    },
    async ({ message }) => {
      const responseText = await runBigQueryAgentPrompt(message);
      return {
        content: [{ type: 'text', text: responseText }],
      };
    },
  );

  return server;
}
