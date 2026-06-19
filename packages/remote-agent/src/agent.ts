import { buildMcpCallerHeaders } from '@agent-platform/mcp-auth';
import {
  InMemoryRunner,
  isFinalResponse,
  LlmAgent,
  MCPToolset,
  stringifyContent,
} from '@google/adk';

import { getVerifiedGoogleUser } from './session-context.js';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? 'http://localhost:8080/mcp';
const GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT;
const BQ_METADATA_READER_SA_EMAIL = process.env.BQ_METADATA_READER_SA_EMAIL?.trim();

const MCP_TOOL_NAMES = ['list_datasets', 'get_authenticated_user'] as const;

async function createAgent(): Promise<LlmAgent> {
  const { email, googleAccessToken } = getVerifiedGoogleUser();
  const mcpBaseUrl = MCP_SERVER_URL.replace(/\/mcp\/?$/, '');
  const headers = await buildMcpCallerHeaders(mcpBaseUrl, googleAccessToken);

  const mcpToolset = new MCPToolset(
    {
      type: 'StreamableHTTPConnectionParams',
      url: MCP_SERVER_URL,
      header: headers,
    },
    [...MCP_TOOL_NAMES],
  );

  const projectHint = GOOGLE_CLOUD_PROJECT ?? 'the configured GCP project';
  const bigqueryCredentialHint =
    BQ_METADATA_READER_SA_EMAIL ??
    'bq-metadata-reader (see BQ_METADATA_READER_SA_EMAIL on MCP server)';

  return new LlmAgent({
    model: process.env.AGENT_MODEL ?? 'gemini-2.5-flash',
    name: 'bigquery_assistant',
    instruction: `You help users explore BigQuery datasets in project ${projectHint}.

Identity (from the user's OAuth token — not service account impersonation):
- authenticated_user_email: ${email}

BigQuery data access (service account impersonation on MCP server only):
- bigquery_service_account: ${bigqueryCredentialHint}
- list_datasets uses the impersonated service account above, not the user's BigQuery permissions.

When reporting list_datasets results:
- If status is permission_denied, project_not_found, or error: quote the error field verbatim; never say "no datasets found" or "couldn't find datasets".
- If status is empty: say 0 datasets are visible to the impersonated service account in that project_id.
- If status is ok: list the dataset names.
- Always mention both the signed-in user (authenticated_user_email above) and bigquery_service_account from the tool output.
- For permission_denied, clarify that BigQuery access is via the impersonated SA, not the user's personal BigQuery permissions.

Use list_datasets when asked about datasets. When asked who they are, which Google account is active, or what credentials access BigQuery, call get_authenticated_user or answer from the identity and BigQuery fields above.`,
    tools: [mcpToolset],
  });
}

export async function runAgentPrompt(userMessage: string): Promise<string> {
  const agent = await createAgent();
  const appName = 'bigquery_assistant';
  const runner = new InMemoryRunner({ agent, appName });
  const { email } = getVerifiedGoogleUser();
  const sessionId = crypto.randomUUID();

  await runner.sessionService.createSession({
    appName,
    userId: email,
    sessionId,
  });

  let finalText = '';
  try {
    for await (const event of runner.runAsync({
      userId: email,
      sessionId,
      newMessage: { role: 'user', parts: [{ text: userMessage }] },
    })) {
      if (event.author === 'user') {
        continue;
      }

      const errorCode = 'errorCode' in event ? event.errorCode : undefined;
      const errorMessage = 'errorMessage' in event ? event.errorMessage : undefined;
      if (errorCode) {
        throw new Error(
          typeof errorMessage === 'string' ? errorMessage : `Model error ${String(errorCode)}`,
        );
      }

      const text = stringifyContent(event);
      if (!text) {
        continue;
      }

      if (isFinalResponse(event)) {
        finalText = text;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Agent run failed: ${message}`, { cause: error });
  }

  if (finalText.length > 0) {
    return finalText;
  }

  return 'No response from agent';
}
