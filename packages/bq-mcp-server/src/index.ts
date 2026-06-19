import { randomUUID } from 'node:crypto';

import {
  assertServiceAuthModeAllowed,
  getEmailFromGoogleAccessToken,
  getHttpHeader,
  resolveDelegatedUserAccessToken,
  resolvePrmResourceUrl,
  USER_ACCESS_TOKEN_HEADER,
  verifyMcpServiceCaller,
  writeProtectedResourceMetadata,
  authRouteRateLimit,
  type GoogleUserContext,
  type ServiceCallerIdentity,
} from '@agent-platform/mcp-auth';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
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

const MCP_SESSION_HEADER = 'mcp-session-id';
const INVALID_SESSION_MESSAGE = 'Invalid or missing session';
const INVALID_SESSION_RESPONSE = 'Invalid session';

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

const sessions = new Map<string, StreamableHTTPServerTransport>();

const app = express();
app.use(json());

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  writeProtectedResourceMetadata(res, {
    resource: resolvePrmResourceUrl(req.headers, serverUrl.toString()),
    authorizationServers: [GOOGLE_OAUTH_AUTHORIZATION_SERVER],
    scopesSupported: ['openid', 'email', 'https://www.googleapis.com/auth/bigquery'],
  });
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok' });
});

async function verifyDelegatedUserAccessToken(userToken: string): Promise<GoogleUserContext> {
  const email = await getEmailFromGoogleAccessToken(userToken);

  return { email, googleAccessToken: userToken };
}

async function runAuthorizedMcpRequest(
  req: Request,
  res: Response,
  options: {
    allowInitialize: boolean;
    onUnauthorized: () => void;
    onMissingUserToken: () => void;
    onInvalidUserToken: () => void;
    onInvalidSession: () => void;
    handle: (transport: StreamableHTTPServerTransport, user: GoogleUserContext) => Promise<void>;
  },
): Promise<void> {
  let caller: ServiceCallerIdentity | undefined;
  try {
    caller = await ensureServiceAuth(req);
  } catch {
    options.onUnauthorized();
    return;
  }

  const sessionId = getHttpHeader(req.headers, MCP_SESSION_HEADER);
  const transport = options.allowInitialize
    ? await resolveTransport(req, res, sessionId)
    : getExistingTransport(sessionId);

  if (!transport) {
    if (!options.allowInitialize) {
      options.onInvalidSession();
    }
    return;
  }

  const userToken = resolveDelegatedUserAccessToken(req.headers, {
    excludeJwtFromAuthorization: true,
  });
  if (!userToken) {
    options.onMissingUserToken();
    return;
  }

  let user: GoogleUserContext;
  try {
    user = await verifyDelegatedUserAccessToken(userToken);
    if (caller && !caller.isServiceAccount && caller.email !== user.email) {
      throw new Error('Delegated user token does not match caller identity');
    }
  } catch {
    options.onInvalidUserToken();
    return;
  }

  await options.handle(transport, user);
}

app.post('/mcp', authRouteRateLimit, async (req, res) => {
  await runAuthorizedMcpRequest(req, res, {
    allowInitialize: true,
    onUnauthorized: () => res.status(401).json({ error: 'Unauthorized service caller' }),
    onMissingUserToken: () =>
      res.status(400).json({
        error: `Missing ${USER_ACCESS_TOKEN_HEADER} header or Google access token on Authorization`,
      }),
    onInvalidUserToken: () =>
      res.status(403).json({ error: 'Invalid or forbidden user access token' }),
    onInvalidSession: () => {},
    handle: async (transport, user) => {
      await verifiedUserStorage.run(user, async () => {
        await transport.handleRequest(req, res, req.body);
      });
    },
  });
});

async function handleSessionTransportRequest(req: Request, res: Response): Promise<void> {
  await runAuthorizedMcpRequest(req, res, {
    allowInitialize: false,
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

async function ensureServiceAuth(req: Request): Promise<ServiceCallerIdentity | undefined> {
  const authorization = getHttpHeader(req.headers, 'authorization');
  return verifyMcpServiceCaller(authorization, {
    authMode: AUTH_MODE,
    expectedServiceAccountEmail: EXPECTED_CALLER_SA_EMAIL,
    audience: serverUrl.origin,
  });
}

function getExistingTransport(
  sessionId: string | undefined,
): StreamableHTTPServerTransport | undefined {
  if (sessionId === undefined) {
    return undefined;
  }

  return sessions.get(sessionId);
}

async function resolveTransport(
  req: Request,
  res: Response,
  sessionId: string | undefined,
): Promise<StreamableHTTPServerTransport | undefined> {
  const existing = getExistingTransport(sessionId);
  if (existing) {
    return existing;
  }

  if (sessionId === undefined && isInitializeRequest(req.body)) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport);
      },
    });

    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) {
        sessions.delete(id);
      }
    };

    const server = createMcpServer();
    await server.connect(transport);
    return transport;
  }

  res.status(400).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: INVALID_SESSION_MESSAGE },
    id: null,
  });
  return undefined;
}

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
