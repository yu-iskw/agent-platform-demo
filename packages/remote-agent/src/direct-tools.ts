import { buildMcpCallerHeadersForAgent } from '@agent-platform/mcp-auth';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { getVerifiedGoogleUser } from './user-context.js';

import type { DemoAction } from '@agent-platform/agent-client';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:8080/mcp';

function resolveListDatasetsProjectId(projectId: string | undefined): string {
  const resolved = projectId?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim();
  if (!resolved) {
    throw new Error(
      'GOOGLE_CLOUD_PROJECT is required for list_datasets when no projectId is provided',
    );
  }
  return resolved;
}

type ToolContent = {
  type: string;
  text?: string;
};

function extractToolText(content: ToolContent[]): string {
  const textPart = content.find((part) => part.type === 'text' && part.text !== undefined);
  return textPart?.text ?? JSON.stringify(content, null, 2);
}

function formatDirectReply(rawText: string): string {
  try {
    return JSON.stringify(JSON.parse(rawText) as unknown, null, 2);
  } catch {
    return rawText;
  }
}

async function callBqMcpTool(toolName: string, args: Record<string, string>): Promise<string> {
  const { email, googleAccessToken } = getVerifiedGoogleUser();
  const mcpBaseUrl = MCP_SERVER_URL.replace(/\/mcp\/?$/, '');
  const headers = await buildMcpCallerHeadersForAgent(mcpBaseUrl, { email, googleAccessToken });

  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
    requestInit: { headers },
  });
  const client = new Client({ name: 'remote-agent', version: '0.1.0' });

  await client.connect(transport);
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    return extractToolText(result.content as ToolContent[]);
  } finally {
    await client.close();
  }
}

export async function runDirectTool(
  action: DemoAction,
  projectId: string | undefined,
): Promise<string> {
  if (action === 'list_datasets') {
    const resolvedProjectId = resolveListDatasetsProjectId(projectId);
    const rawText = await callBqMcpTool('list_datasets', { project_id: resolvedProjectId });
    return formatDirectReply(rawText);
  }

  const rawText = await callBqMcpTool('get_authenticated_user', {});
  return formatDirectReply(rawText);
}
