import {
  DELEGATION_TOKEN_HEADER,
  isDelegationJwtConfigured,
  mintDelegationJwt,
} from './delegation-jwt.js';
import { fetchCloudRunIdToken } from './service-auth-outbound.js';
import { USER_ACCESS_TOKEN_HEADER } from './user-access-token.js';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
} as const;

function resolveAuthMode(authMode?: string): string {
  return authMode ?? process.env.MCP_AUTH_MODE ?? process.env.AUTH_MODE ?? 'cloud';
}

async function buildCloudRunMcpHeaders(
  mcpServerUrl: string,
  delegationHeaders: Record<string, string>,
  authMode: string,
): Promise<Record<string, string>> {
  if (authMode === 'google') {
    return {
      ...JSON_HEADERS,
      ...delegationHeaders,
    };
  }

  const idToken = await fetchCloudRunIdToken(mcpServerUrl);
  return {
    ...JSON_HEADERS,
    ...delegationHeaders,
    Authorization: `Bearer ${idToken}`,
  };
}

export async function buildMcpCallerHeadersForAgent(
  mcpServerUrl: string,
  input: { email: string; googleAccessToken?: string },
  authMode: string = resolveAuthMode(),
): Promise<Record<string, string>> {
  const origin = new URL(mcpServerUrl).origin;

  if (isDelegationJwtConfigured()) {
    const delegationToken = await mintDelegationJwt({ email: input.email, audience: origin });
    return buildCloudRunMcpHeaders(
      mcpServerUrl,
      { [DELEGATION_TOKEN_HEADER]: `Bearer ${delegationToken}` },
      authMode,
    );
  }

  if (input.googleAccessToken) {
    return buildMcpCallerHeadersForDirect(mcpServerUrl, input.googleAccessToken, authMode);
  }

  throw new Error(
    'DELEGATION_JWT_SECRET is not configured and no googleAccessToken was provided for MCP passthrough',
  );
}

export async function buildMcpCallerHeadersForDirect(
  mcpServerUrl: string,
  userAccessToken: string,
  authMode: string = resolveAuthMode(),
): Promise<Record<string, string>> {
  const delegationHeaders = {
    [USER_ACCESS_TOKEN_HEADER]: userAccessToken,
  };

  if (authMode === 'google') {
    return {
      ...JSON_HEADERS,
      ...delegationHeaders,
      Authorization: `Bearer ${userAccessToken}`,
    };
  }

  return buildCloudRunMcpHeaders(mcpServerUrl, delegationHeaders, authMode);
}
