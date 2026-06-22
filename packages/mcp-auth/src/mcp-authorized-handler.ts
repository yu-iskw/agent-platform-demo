import { randomUUID } from 'node:crypto';

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { getHttpHeader } from './http-header.js';
import { resolvePrmResourceUrl, writeProtectedResourceMetadata } from './mcp-protected-resource.js';
import { resolveAuthorizedMcpUser } from './resolve-mcp-user.js';

import type { GoogleUserContext } from './google-user-auth-middleware.js';
import type { ServiceCallerIdentity } from './service-auth-inbound.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Application, Request, Response } from 'express';

const MCP_SESSION_HEADER = 'mcp-session-id';

const INVALID_SESSION_MESSAGE = 'Invalid or missing session';
export const INVALID_SESSION_RESPONSE = 'Invalid session';
const DEFAULT_AUTHORIZATION_SERVER = 'https://accounts.google.com';
export const DEFAULT_MCP_OAUTH_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/bigquery',
] as const;

export type McpSessionRegistry = {
  getExistingTransport(sessionId: string | undefined): StreamableHTTPServerTransport | undefined;
  resolveTransport(
    req: Request,
    res: Response,
    sessionId: string | undefined,
  ): Promise<StreamableHTTPServerTransport | undefined>;
};

export function createMcpSessionRegistry(options: {
  createMcpServer: () => McpServer;
}): McpSessionRegistry {
  const sessions = new Map<string, StreamableHTTPServerTransport>();

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

      const server = options.createMcpServer();
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

  return { getExistingTransport, resolveTransport };
}

export function mountMcpOAuthRoutes(
  app: Application,
  options: {
    mcpResourceUrl: string;
    scopesSupported?: readonly string[];
    authorizationServer?: string;
  },
): void {
  const serverUrl = new URL(options.mcpResourceUrl);
  const authorizationServer = options.authorizationServer ?? DEFAULT_AUTHORIZATION_SERVER;
  const scopesSupported = options.scopesSupported ?? DEFAULT_MCP_OAUTH_SCOPES;

  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    writeProtectedResourceMetadata(res, {
      resource: resolvePrmResourceUrl(req.headers, serverUrl.toString()),
      authorizationServers: [authorizationServer],
      scopesSupported: [...scopesSupported],
    });
  });
}

export type RunAuthorizedMcpRequestOptions = {
  sessionRegistry: McpSessionRegistry;
  allowInitialize: boolean;
  expectedAudience: string;
  verifyServiceCaller?: (req: Request) => Promise<ServiceCallerIdentity | undefined>;
  onUnauthorized?: () => void;
  onMissingUserToken: () => void;
  onInvalidUserToken: () => void;
  onInvalidSession?: () => void;
  handle: (transport: StreamableHTTPServerTransport, user: GoogleUserContext) => Promise<void>;
};

async function resolveAuthorizedUserContext(
  req: Request,
  caller: ServiceCallerIdentity | undefined,
  options: Pick<
    RunAuthorizedMcpRequestOptions,
    'expectedAudience' | 'onMissingUserToken' | 'onInvalidUserToken'
  >,
): Promise<GoogleUserContext | undefined> {
  try {
    const resolvedUser = await resolveAuthorizedMcpUser(req.headers, caller, {
      expectedAudience: options.expectedAudience,
    });
    if (!resolvedUser) {
      options.onMissingUserToken();
      return undefined;
    }
    return resolvedUser;
  } catch {
    options.onInvalidUserToken();
    return undefined;
  }
}

export async function runAuthorizedMcpRequest(
  req: Request,
  res: Response,
  options: RunAuthorizedMcpRequestOptions,
): Promise<void> {
  let caller: ServiceCallerIdentity | undefined;
  if (options.verifyServiceCaller) {
    try {
      caller = await options.verifyServiceCaller(req);
    } catch {
      options.onUnauthorized?.();
      return;
    }
  }

  const sessionId = getHttpHeader(req.headers, MCP_SESSION_HEADER);
  const userCallbacks = {
    expectedAudience: options.expectedAudience,
    onMissingUserToken: options.onMissingUserToken,
    onInvalidUserToken: options.onInvalidUserToken,
  };

  if (!options.allowInitialize) {
    const transport = options.sessionRegistry.getExistingTransport(sessionId);
    if (!transport) {
      options.onInvalidSession?.();
      return;
    }

    const user = await resolveAuthorizedUserContext(req, caller, userCallbacks);
    if (!user) {
      return;
    }

    await options.handle(transport, user);
    return;
  }

  const user = await resolveAuthorizedUserContext(req, caller, userCallbacks);
  if (!user) {
    return;
  }

  const transport = await options.sessionRegistry.resolveTransport(req, res, sessionId);
  if (!transport) {
    return;
  }

  await options.handle(transport, user);
}
