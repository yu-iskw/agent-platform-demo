import { AsyncLocalStorage } from 'node:async_hooks';

import { runWithUserAuthorization } from '@agent-platform/agent-client';
import { fetchCloudRunIdToken } from '@agent-platform/mcp-auth';

import type { AuthProbePreset } from '@/lib/auth-trace';

export type { AuthProbePreset };

export type AuthProbeResult = {
  preset: AuthProbePreset;
  httpStatus: number;
  ok: boolean;
  error: string | null;
};

export class AuthProfileError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = 'AuthProfileError';
    this.httpStatus = httpStatus;
  }
}

const profileFetchStorage = new AsyncLocalStorage<typeof fetch>();
const nativeFetch = globalThis.fetch.bind(globalThis);
let profileFetchInstalled = false;

function agentPolicyUrl(hostUrl: string): string {
  return `${hostUrl.replace(/\/$/, '')}/agent-policy`;
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

function isCloudRunAgentUrl(agentUrl: string): boolean {
  try {
    return new URL(agentUrl).hostname.endsWith('.run.app');
  } catch {
    return false;
  }
}

function shouldApplyCloudRunAgentAuth(requestUrl: string, agentUrl: string): boolean {
  if (!isCloudRunAgentUrl(agentUrl)) {
    return false;
  }
  try {
    return new URL(requestUrl).origin === new URL(agentUrl).origin;
  } catch {
    return false;
  }
}

function installProfileFetch(): void {
  if (profileFetchInstalled) {
    return;
  }

  const previousFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    const profileFetch = profileFetchStorage.getStore();
    if (profileFetch) {
      return profileFetch(input, init);
    }
    return previousFetch(input, init);
  };
  profileFetchInstalled = true;
}

function createIamOnlyFetch(hostUrl: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const requestUrl = resolveRequestUrl(input);

    if (shouldApplyCloudRunAgentAuth(requestUrl, hostUrl)) {
      const audience = new URL(hostUrl).origin;
      const idToken = await fetchCloudRunIdToken(audience);
      headers.set('Authorization', `Bearer ${idToken}`);
    }

    return nativeFetch(input, { ...init, headers });
  };
}

export function parseAuthProbePreset(value: unknown): AuthProbePreset | null {
  if (value === 'full' || value === 'no_iam' || value === 'iam_only' || value === 'no_session') {
    return value;
  }
  return null;
}

export function rejectNonFullFreeformChat(input: {
  useRemoteAgent: boolean;
  demoAction: unknown;
  authPreset: AuthProbePreset;
}): string | null {
  if (input.useRemoteAgent && !input.demoAction && input.authPreset !== 'full') {
    return 'Switch to Full auth profile for free-form chat';
  }
  return null;
}

function probeResult(
  preset: AuthProbePreset,
  httpStatus: number,
  error: string | null = null,
): AuthProbeResult {
  return {
    preset,
    httpStatus,
    ok: httpStatus >= 200 && httpStatus < 300,
    error,
  };
}

export async function runWithAuthProfile<T>(
  preset: AuthProbePreset,
  hostUrl: string,
  googleAccessToken: string | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (preset === 'no_session') {
    throw new AuthProfileError('Session required', 401);
  }

  if (preset === 'full') {
    if (!googleAccessToken) {
      throw new AuthProfileError('Session required', 401);
    }
    return runWithUserAuthorization(googleAccessToken, hostUrl, operation);
  }

  installProfileFetch();

  if (preset === 'no_iam') {
    return profileFetchStorage.run(nativeFetch, operation);
  }

  return profileFetchStorage.run(createIamOnlyFetch(hostUrl), operation);
}

export async function runAuthProbe(input: {
  preset: AuthProbePreset;
  hostUrl: string;
  googleAccessToken?: string;
}): Promise<AuthProbeResult> {
  const { preset, hostUrl, googleAccessToken } = input;
  const url = agentPolicyUrl(hostUrl);

  try {
    const httpStatus = await runWithAuthProfile(preset, hostUrl, googleAccessToken, async () => {
      const response = await fetch(url);
      return response.status;
    });
    return probeResult(
      preset,
      httpStatus,
      httpStatus >= 200 && httpStatus < 300
        ? null
        : `Agent policy fetch failed (HTTP ${httpStatus})`,
    );
  } catch (probeError) {
    if (probeError instanceof AuthProfileError) {
      return probeResult(preset, probeError.httpStatus, probeError.message);
    }
    const message = probeError instanceof Error ? probeError.message : 'Auth probe failed';
    return probeResult(preset, 502, message);
  }
}
