import { randomUUID } from 'node:crypto';

import {
  getEmailFromGoogleAccessToken,
  getHttpHeader,
  resolveDelegatedUserAccessToken,
  resolvePrmResourceUrl,
  writeProtectedResourceMetadata,
  authRouteRateLimit,
  type GoogleUserContext,
} from '@agent-platform/mcp-auth';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { runBigQueryAgentPrompt } from './agent.js';
import { verifiedUserStorage } from './session-context.js';

import type { Application, Request, Response } from 'express';

const GOOGLE_OAUTH_AUTHORIZATION_SERVER = 'https://accounts.google.com';
const MCP_SESSION_HEADER = 'mcp-session-id';
const INVALID_SESSION_MESSAGE = 'Invalid or missing session';
const INVALID_SESSION_RESPONSE = 'Invalid session';

const sessions = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
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

async function verifyUserAccessToken(userToken: string): Promise<GoogleUserContext> {
  const email = await getEmailFromGoogleAccessToken(userToken);
  return { email, googleAccessToken: userToken };
}

async function runAuthorizedMcpRequest(
  req: Request,
  res: Response,
  options: {
    allowInitialize: boolean;
    onMissingUserToken: () => void;
    onInvalidUserToken: () => void;
    onInvalidSession: () => void;
    handle: (transport: StreamableHTTPServerTransport, user: GoogleUserContext) => Promise<void>;
  },
): Promise<void> {
  const userToken = resolveDelegatedUserAccessToken(req.headers, {
    excludeJwtFromAuthorization: true,
  });
  if (!userToken) {
    options.onMissingUserToken();
    return;
  }

  let user: GoogleUserContext;
  try {
    user = await verifyUserAccessToken(userToken);
  } catch {
    options.onInvalidUserToken();
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

  await options.handle(transport, user);
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

async function handleSessionTransportRequest(req: Request, res: Response): Promise<void> {
  await runAuthorizedMcpRequest(req, res, {
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

export function mountAgentMcpRoutes(app: Application, options: { mcpResourceUrl: string }): void {
  const serverUrl = new URL(options.mcpResourceUrl);

  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    writeProtectedResourceMetadata(res, {
      resource: resolvePrmResourceUrl(req.headers, serverUrl.toString()),
      authorizationServers: [GOOGLE_OAUTH_AUTHORIZATION_SERVER],
      scopesSupported: ['openid', 'email', 'https://www.googleapis.com/auth/bigquery'],
    });
  });

  app.post('/mcp', authRouteRateLimit, async (req, res) => {
    await runAuthorizedMcpRequest(req, res, {
      allowInitialize: true,
      onMissingUserToken: () => res.status(401).json({ error: 'Missing Google access token' }),
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

  app.get('/mcp', authRouteRateLimit, (req, res) => {
    void handleSessionTransportRequest(req, res);
  });

  app.delete('/mcp', authRouteRateLimit, (req, res) => {
    void handleSessionTransportRequest(req, res);
  });
}
