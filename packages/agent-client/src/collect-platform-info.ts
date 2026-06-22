import { buildMcpCallerHeaders } from '@agent-platform/mcp-auth';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { fetchAgentCard, fetchAgentCardForHost, normalizeBaseUrl } from './fetch-agent-card.js';
import { readJsonResponse } from './read-json-response.js';

import type { AgentCard } from '@a2a-js/sdk';

export type PrmMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
};

export type McpToolMetadata = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
};

export type McpServerMetadata = {
  prm: PrmMetadata | null;
  tools: McpToolMetadata[];
  error?: string;
};

export type PlatformInfo = {
  a2a: AgentCard;
  agentMcp: McpServerMetadata;
  /** Present only when `includeBqMcp` is true (IDE/agent-cli). Web-chat omits direct bq-mcp calls. */
  bqMcp?: McpServerMetadata;
};

export type CollectPlatformInfoOptions = {
  agentUrl: string;
  googleAccessToken: string;
  /** When set, fetches this agent's card instead of the legacy well-known card. */
  agentId?: string;
  agentMcpUrl?: string;
  bqMcpUrl?: string;
  /** When false, skips live bq-mcp MCP discovery (web-chat uses A2A → remote-agent → bq-mcp only). */
  includeBqMcp?: boolean;
};

type PrmResponse = {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
};

function mcpOrigin(mcpUrl: string): string {
  return new URL(mcpUrl).origin;
}

function defaultAgentMcpUrl(agentUrl: string): string {
  return `${normalizeBaseUrl(agentUrl)}/mcp`;
}

function defaultBqMcpUrl(): string {
  return 'http://127.0.0.1:8080/mcp';
}

async function fetchPrmMetadata(
  origin: string,
  headers: Record<string, string>,
): Promise<PrmMetadata> {
  const response = await fetch(`${origin}/.well-known/oauth-protected-resource`, { headers });

  if (!response.ok) {
    throw new Error(`PRM fetch failed (HTTP ${response.status})`);
  }

  const body = await readJsonResponse<PrmResponse>(response, 'OAuth PRM');
  if (!body.resource) {
    throw new Error('PRM response missing resource');
  }

  return {
    resource: body.resource,
    authorization_servers: body.authorization_servers ?? [],
    scopes_supported: body.scopes_supported ?? [],
  };
}

async function listMcpTools(
  mcpUrl: string,
  headers: Record<string, string>,
): Promise<McpToolMetadata[]> {
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers },
  });
  const client = new Client({ name: 'agent-platform-info', version: '0.1.0' });

  await client.connect(transport);
  try {
    const { tools } = await client.listTools();
    return tools.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  } finally {
    await client.close();
  }
}

async function collectMcpServerMetadata(
  mcpUrl: string,
  googleAccessToken: string,
): Promise<McpServerMetadata> {
  try {
    const origin = mcpOrigin(mcpUrl);
    const headers = await buildMcpCallerHeaders(origin, googleAccessToken);
    const [prm, tools] = await Promise.all([
      fetchPrmMetadata(origin, headers),
      listMcpTools(mcpUrl, headers),
    ]);
    return { prm, tools };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP metadata collection failed';
    return { prm: null, tools: [], error: message };
  }
}

export async function collectPlatformInfo(
  options: CollectPlatformInfoOptions,
): Promise<PlatformInfo> {
  const agentMcpUrl = options.agentMcpUrl ?? defaultAgentMcpUrl(options.agentUrl);
  const includeBqMcp = options.includeBqMcp ?? true;

  const [a2a, agentMcp, bqMcp] = await Promise.all([
    options.agentId
      ? fetchAgentCardForHost(options.agentUrl, options.agentId)
      : fetchAgentCard(options.agentUrl),
    collectMcpServerMetadata(agentMcpUrl, options.googleAccessToken),
    includeBqMcp
      ? collectMcpServerMetadata(options.bqMcpUrl ?? defaultBqMcpUrl(), options.googleAccessToken)
      : Promise.resolve(undefined),
  ]);

  return bqMcp === undefined ? { a2a, agentMcp } : { a2a, agentMcp, bqMcp };
}
