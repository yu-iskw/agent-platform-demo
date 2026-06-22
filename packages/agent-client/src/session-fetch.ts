import { AsyncLocalStorage } from 'node:async_hooks';

import { fetchCloudRunIdToken, SESSION_AUTHORIZATION_HEADER } from '@agent-platform/mcp-auth';

import { assertAllowedAgentHostUrl } from './fetch-agent-card.js';

const agentFetchStorage = new AsyncLocalStorage<typeof fetch>();
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

/** Only attach user OAuth token to requests targeting the configured agent origin. */
function shouldAttachUserToken(requestUrl: string, agentUrl: string): boolean {
  try {
    assertAllowedAgentHostUrl(agentUrl);
    return new URL(requestUrl).origin === new URL(agentUrl).origin;
  } catch {
    return false;
  }
}

function createAuthorizedFetch(googleAccessToken: string, agentUrl: string): typeof fetch {
  assertAllowedAgentHostUrl(agentUrl);

  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const requestUrl = resolveRequestUrl(input);

    if (shouldApplyCloudRunAgentAuth(requestUrl, agentUrl)) {
      const audience = new URL(agentUrl).origin;
      const idToken = await fetchCloudRunIdToken(audience);
      headers.set('Authorization', `Bearer ${idToken}`);
      headers.set(SESSION_AUTHORIZATION_HEADER, `Bearer ${googleAccessToken}`);
    } else if (!headers.has('Authorization') && shouldAttachUserToken(requestUrl, agentUrl)) {
      headers.set('Authorization', `Bearer ${googleAccessToken}`);
    }

    return nativeFetch(input, { ...init, headers });
  };
}

function installAuthorizedFetch(): void {
  if (authorizedFetchInstalled) {
    return;
  }

  globalThis.fetch = (input, init) => {
    const authorizedFetch = agentFetchStorage.getStore();
    if (authorizedFetch) {
      return authorizedFetch(input, init);
    }
    return nativeFetch(input, init);
  };
  authorizedFetchInstalled = true;
}

export function runWithUserAuthorization<T>(
  googleAccessToken: string,
  agentUrl: string,
  operation: () => Promise<T>,
): Promise<T> {
  assertAllowedAgentHostUrl(agentUrl);
  installAuthorizedFetch();
  const authorizedFetch = createAuthorizedFetch(googleAccessToken, agentUrl);
  return agentFetchStorage.run(authorizedFetch, operation);
}
