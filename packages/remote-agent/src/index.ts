import { A2AExpressApp, DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import { createGoogleUserAuthMiddleware } from '@agent-platform/mcp-auth';
import express, { json } from 'express';

import { BigQueryAgentExecutor, buildAgentCard } from './a2a-executor.js';
import { mountAgentMcpRoutes } from './mcp-routes.js';
import { verifiedUserStorage } from './session-context.js';

import type { AgentCard } from '@a2a-js/sdk';

const PORT = Number(process.env.PORT ?? 8081);
const HOST = process.env.HOST ?? '0.0.0.0';
const PUBLIC_AGENT_URL = process.env.PUBLIC_AGENT_URL ?? `http://localhost:${PORT}`;
const MCP_RESOURCE_URL = process.env.MCP_RESOURCE_URL ?? `http://localhost:${PORT}/mcp`;

const agentCard: AgentCard = buildAgentCard(PUBLIC_AGENT_URL);
const requestHandler = new DefaultRequestHandler(
  agentCard,
  new InMemoryTaskStore(),
  new BigQueryAgentExecutor(),
);

const app = express();

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// MCP routes need JSON; A2A SDK registers its own body parser — do not use app.use(json()) globally.
app.use('/mcp', json());

mountAgentMcpRoutes(app, { mcpResourceUrl: MCP_RESOURCE_URL });

const googleUserAuthMiddleware = createGoogleUserAuthMiddleware({
  userContext: verifiedUserStorage,
});

const a2aApp = new A2AExpressApp(requestHandler);
// @a2a-js/sdk types target Express 4; runtime uses Express 5.
a2aApp.setupRoutes(app as never, '', [googleUserAuthMiddleware as never]);

app.listen(PORT, HOST, () => {
  console.log(`remote-agent listening on http://${HOST}:${PORT}`);
  console.log(`Agent card: http://${HOST}:${PORT}/.well-known/agent.json`);
  console.log(`MCP endpoint: ${MCP_RESOURCE_URL}`);
});
