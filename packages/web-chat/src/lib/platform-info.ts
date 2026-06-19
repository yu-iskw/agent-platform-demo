import type { McpServerMetadata, PlatformInfo } from '@agent-platform/agent-client';

export type {
  McpServerMetadata,
  McpToolMetadata,
  PlatformInfo,
} from '@agent-platform/agent-client';

function formatSecuritySchemes(schemes: PlatformInfo['a2a']['securitySchemes']): string[] {
  if (!schemes) {
    return [];
  }

  return Object.entries(schemes).map(([key, value]) => {
    if (value.type === 'openIdConnect' && value.openIdConnectUrl) {
      return `${key}: OpenID Connect (${value.openIdConnectUrl})`;
    }
    return `${key}: ${value.type}`;
  });
}

export function a2aSummaryLines(info: PlatformInfo): string[] {
  const { a2a } = info;
  const lines = [
    `Endpoint: ${a2a.url}`,
    `Protocol: A2A message/send`,
    ...(a2a.version ? [`Version: ${a2a.version}`] : []),
    ...(a2a.description ? [a2a.description] : []),
  ];

  const schemes = formatSecuritySchemes(a2a.securitySchemes);
  if (schemes.length > 0) {
    lines.push('Authentication (from agent card):');
    lines.push(...schemes.map((line) => `  • ${line}`));
  }

  if (a2a.skills.length > 0) {
    lines.push('Skills:');
    lines.push(
      ...a2a.skills.map(
        (skill) => `  • ${skill.name}${skill.description ? ` — ${skill.description}` : ''}`,
      ),
    );
  }

  return lines;
}

/** bq-mcp is reached only via remote-agent; web-chat does not open MCP sessions to bq-mcp. */
export const bqMcpChainMetadata: McpServerMetadata = {
  prm: null,
  tools: [
    {
      name: 'list_datasets',
      description: 'List BigQuery datasets in a project (remote-agent → bq-mcp)',
    },
    {
      name: 'get_authenticated_user',
      description: 'Return the Google account from the delegated OAuth token',
    },
  ],
};

export function bqMcpChainSummaryLines(): string[] {
  return [
    'Access path: web-chat → A2A → remote-agent → bq-mcp (not queried directly from web-chat)',
    'Live discovery: use ./scripts/proxy-mcp.sh and IDE MCP config for direct bq-mcp metadata',
  ];
}

export function mcpSummaryLines(label: string, server: PlatformInfo['agentMcp']): string[] {
  const lines: string[] = [];

  if (server.prm) {
    lines.push(`Resource: ${server.prm.resource}`);
    if (server.prm.authorization_servers.length > 0) {
      lines.push(`Authorization servers: ${server.prm.authorization_servers.join(', ')}`);
    }
    if (server.prm.scopes_supported.length > 0) {
      lines.push(`Scopes: ${server.prm.scopes_supported.join(', ')}`);
    }
  }

  if (server.error) {
    lines.push(`Error: ${server.error}`);
  }

  if (lines.length === 0) {
    lines.push(`${label}: no metadata available`);
  }

  return lines;
}
