import { AsyncLocalStorage } from 'node:async_hooks';

import { fetchCloudRunIdToken, SESSION_AUTHORIZATION_HEADER } from '@agent-platform/mcp-auth';

type AgentAuthContext = {
  googleAccessToken: string;
  agentUrl: string;
};

const agentAuthStorage = new AsyncLocalStorage<AgentAuthContext>();
const nativeFetch = globalThis.fetch.bind(globalThis);

let authorizedFetchInstalled = false;

function isCloudRunAgentUrl(agentUrl: string): boolean {
  try {
    return new URL(agentUrl).hostname.endsWith('.run.app');
  } catch {
    return false;
  }
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

/** Only patch Cloud Run IAM for requests to the agent origin (not bq-mcp or other MCP URLs). */
export function shouldApplyCloudRunAgentAuth(requestUrl: string, agentUrl: string): boolean {
  if (!isCloudRunAgentUrl(agentUrl)) {
    return false;
  }
  try {
    return new URL(requestUrl).origin === new URL(agentUrl).origin;
  } catch {
    return false;
  }
}

function installAuthorizedFetch(): void {
  if (authorizedFetchInstalled) {
    return;
  }

  globalThis.fetch = async (input, init) => {
    const context = agentAuthStorage.getStore();
    if (!context) {
      return nativeFetch(input, init);
    }

    const headers = new Headers(init?.headers);
    const requestUrl = resolveRequestUrl(input);

    if (shouldApplyCloudRunAgentAuth(requestUrl, context.agentUrl)) {
      const audience = new URL(context.agentUrl).origin;
      const idToken = await fetchCloudRunIdToken(audience);
      headers.set('Authorization', `Bearer ${idToken}`);
      headers.set(SESSION_AUTHORIZATION_HEADER, `Bearer ${context.googleAccessToken}`);
    } else if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${context.googleAccessToken}`);
    }

    return nativeFetch(input, { ...init, headers });
  };
  authorizedFetchInstalled = true;
}

export function runWithUserAuthorization<T>(
  googleAccessToken: string,
  agentUrl: string,
  operation: () => Promise<T>,
): Promise<T> {
  installAuthorizedFetch();
  return agentAuthStorage.run({ googleAccessToken, agentUrl }, operation);
}
