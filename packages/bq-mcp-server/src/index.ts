import {
  assertServiceAuthModeAllowed,
  authRouteRateLimit,
  createMcpSessionRegistry,
  getHttpHeader,
  INVALID_SESSION_RESPONSE,
  mountMcpOAuthRoutes,
  runAuthorizedMcpRequest,
  USER_ACCESS_TOKEN_HEADER,
  verifyMcpServiceCaller,
} from '@agent-platform/mcp-auth';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express, { json } from 'express';
import { z } from 'zod';

import { listDatasetsForCurrentUser } from './bigquery.js';
import { verifiedUserStorage, getVerifiedGoogleUser } from './request-context.js';

import type { Request, Response } from 'express';

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? '0.0.0.0';
const AUTH_MODE = process.env.AUTH_MODE ?? 'cloud';
assertServiceAuthModeAllowed(AUTH_MODE);
const EXPECTED_CALLER_SA_EMAIL = process.env.EXPECTED_CALLER_SA_EMAIL;
const MCP_RESOURCE_URL = process.env.MCP_RESOURCE_URL ?? `http://localhost:${PORT}`;
const BQ_METADATA_READER_SA_EMAIL = process.env.BQ_METADATA_READER_SA_EMAIL?.trim();

if (!BQ_METADATA_READER_SA_EMAIL) {
  throw new Error('BQ_METADATA_READER_SA_EMAIL is required');
}

const GOOGLE_OAUTH_AUTHORIZATION_SERVER = 'https://accounts.google.com';

const serverUrl = new URL(MCP_RESOURCE_URL);

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'bq-mcp-server',
    version: '0.1.0',
  });

  server.registerTool(
    'get_authenticated_user',
    {
      title: 'Get authenticated user',
      description:
        'Return identity from the delegated OAuth token (not impersonation) and which service account MCP uses for BigQuery',
      inputSchema: z.object({}),
    },
    () => {
      const { email } = getVerifiedGoogleUser();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              email,
              credential_source: 'user_oauth_access_token',
              bigquery_credential_source: 'impersonated_service_account',
              bigquery_service_account: BQ_METADATA_READER_SA_EMAIL,
              auth_mode: AUTH_MODE,
            }),
          },
        ],
      };
    },
  );

  server.registerTool(
    'list_datasets',
    {
      title: 'List BigQuery datasets',
      description:
        'List datasets in a GCP project using impersonated bq-metadata-reader service account credentials. Returns status, credential SA, datasets, and error when access fails.',
      inputSchema: {
        project_id: z.string().describe('GCP project ID'),
      },
    },
    async ({ project_id: projectId }) => {
      const result = await listDatasetsForCurrentUser(projectId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    },
  );

  return server;
}

const sessionRegistry = createMcpSessionRegistry({ createMcpServer });

const app = express();
app.use(json());

mountMcpOAuthRoutes(app, {
  mcpResourceUrl: MCP_RESOURCE_URL,
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

async function ensureServiceAuth(req: Request) {
  const authorization = getHttpHeader(req.headers, 'authorization');
  return await verifyMcpServiceCaller(authorization, {
    authMode: AUTH_MODE,
    expectedServiceAccountEmail: EXPECTED_CALLER_SA_EMAIL,
    audience: serverUrl.origin,
  });
}

async function handleSessionTransportRequest(req: Request, res: Response): Promise<void> {
  await runAuthorizedMcpRequest(req, res, {
    sessionRegistry,
    allowInitialize: false,
    verifyServiceCaller: ensureServiceAuth,
    onUnauthorized: () => res.status(401).end('Unauthorized'),
    onMissingUserToken: () =>
      res
        .status(400)
        .end(`Missing ${USER_ACCESS_TOKEN_HEADER} header or Google access token on Authorization`),
    onInvalidUserToken: () => res.status(403).end('Invalid or forbidden user access token'),
    onInvalidSession: () => res.status(400).end(INVALID_SESSION_RESPONSE),
    handle: async (transport, user) => {
      await verifiedUserStorage.run(user, async () => {
        await transport.handleRequest(req, res);
      });
    },
  });
}

app.post('/mcp', authRouteRateLimit, async (req, res) => {
  await runAuthorizedMcpRequest(req, res, {
    sessionRegistry,
    allowInitialize: true,
    verifyServiceCaller: ensureServiceAuth,
    onUnauthorized: () => res.status(401).json({ error: 'Unauthorized service caller' }),
    onMissingUserToken: () =>
      res.status(400).json({
        error: `Missing ${USER_ACCESS_TOKEN_HEADER} header or Google access token on Authorization`,
      }),
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

app.listen(PORT, HOST, () => {
  console.log(`bq-mcp-server listening on http://${HOST}:${PORT}/mcp`);
  console.log(`AUTH_MODE=${AUTH_MODE}`);
  console.log(`BQ_METADATA_READER_SA_EMAIL=${BQ_METADATA_READER_SA_EMAIL}`);
  console.log(`PRM authorization server: ${GOOGLE_OAUTH_AUTHORIZATION_SERVER}`);
  if (AUTH_MODE === 'cloud') {
    console.log(`Expected caller SA: ${EXPECTED_CALLER_SA_EMAIL ?? '(unset)'}`);
  }
});
