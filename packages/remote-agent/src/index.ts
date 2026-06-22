import { createAgentPolicyStore, mountA2aAgents } from '@agent-platform/a2a-server';
import { createGoogleUserAuthMiddleware } from '@agent-platform/mcp-auth';
import express, { json } from 'express';

import { getAgentDefinitions } from './agent-definitions.js';
import { mountAgentMcpRoutes } from './mcp-routes.js';
import { verifiedUserStorage } from './user-context.js';

const PORT = Number(process.env.PORT ?? 8081);
const HOST = process.env.HOST ?? '0.0.0.0';
const PUBLIC_AGENT_URL = process.env.PUBLIC_AGENT_URL ?? `http://localhost:${PORT}`;
const MCP_RESOURCE_URL = process.env.MCP_RESOURCE_URL ?? `http://localhost:${PORT}/mcp`;

const app = express();
const definitions = getAgentDefinitions();
const policy = createAgentPolicyStore(definitions, PUBLIC_AGENT_URL);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

// MCP routes need JSON; A2A SDK registers its own body parser — do not use app.use(json()) globally.
app.use('/mcp', json());

mountAgentMcpRoutes(app, { mcpResourceUrl: MCP_RESOURCE_URL, policy });

const googleUserAuthMiddleware = createGoogleUserAuthMiddleware({
  userContext: verifiedUserStorage,
});

mountA2aAgents(app, {
  publicBaseUrl: PUBLIC_AGENT_URL,
  authMiddleware: googleUserAuthMiddleware,
  definitions,
  policy,
});

app.listen(PORT, HOST, () => {
  console.log(`remote-agent listening on http://${HOST}:${PORT}`);
  console.log(`API catalog: http://${HOST}:${PORT}/.well-known/api-catalog`);
  console.log(`Agent policy: http://${HOST}:${PORT}/agent-policy`);
  console.log(`Agent card (legacy): http://${HOST}:${PORT}/.well-known/agent-card.json`);
  console.log(`MCP endpoint: ${MCP_RESOURCE_URL}`);
  for (const agent of policy.list()) {
    console.log(`Agent ${agent.id}: ${agent.enabled ? 'enabled' : 'disabled'}`);
  }
});
