import { fetchCloudRunIdToken } from './service-auth.js';
import { USER_ACCESS_TOKEN_HEADER } from './user-access-token.js';

export async function buildMcpCallerHeaders(
  mcpServerUrl: string,
  userAccessToken: string,
  authMode: string = process.env.MCP_AUTH_MODE ?? process.env.AUTH_MODE ?? 'cloud',
): Promise<Record<string, string>> {
  const sharedHeaders = {
    [USER_ACCESS_TOKEN_HEADER]: userAccessToken,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };

  if (authMode === 'google') {
    return {
      ...sharedHeaders,
      Authorization: `Bearer ${userAccessToken}`,
    };
  }

  const idToken = await fetchCloudRunIdToken(mcpServerUrl);

  return {
    ...sharedHeaders,
    Authorization: `Bearer ${idToken}`,
  };
}
