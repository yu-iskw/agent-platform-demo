import { readJsonResponse } from './read-json-response.js';

import type { AgentCard } from '@a2a-js/sdk';

const AGENT_ID_PATTERN = /^[a-z0-9-]+$/;

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function assertAllowedOrigin(url: URL): void {
  const isLocalDev =
    url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  const isCloudRun = url.protocol === 'https:' && url.hostname.endsWith('.run.app');

  if (!isLocalDev && !isCloudRun) {
    throw new Error('Agent host URL is not allowed');
  }
}

/** Validates agent host URL origin (localhost or *.run.app). */
export function assertAllowedAgentHostUrl(agentUrl: string): void {
  try {
    assertAllowedOrigin(new URL(normalizeBaseUrl(agentUrl)));
  } catch (error) {
    if (error instanceof Error && error.message === 'Agent host URL is not allowed') {
      throw error;
    }
    throw new Error('Invalid agent host URL');
  }
}

export function validateAgentId(agentId: string): string {
  const trimmed = agentId.trim();
  if (!AGENT_ID_PATTERN.test(trimmed)) {
    throw new Error('Invalid agent id');
  }
  return trimmed;
}

function normalizeAllowedHost(hostUrl: string): string {
  let url: URL;
  try {
    url = new URL(normalizeBaseUrl(hostUrl));
  } catch {
    throw new Error('Invalid agent host URL');
  }
  assertAllowedOrigin(url);
  return normalizeBaseUrl(hostUrl);
}

/** Card path relative to the agent service URL (matches remote-agent mount + A2A SDK server setup). */
export function resolveAgentCardPath(agentUrl: string): string {
  try {
    const pathname = new URL(agentUrl).pathname.replace(/\/$/, '');
    if (pathname.includes('/agents/')) {
      return 'agent-card.json';
    }
  } catch {
    // fall through to legacy well-known path
  }
  return '.well-known/agent-card.json';
}

export function resolveAgentCardUrl(agentUrl: string): string {
  assertAllowedAgentHostUrl(agentUrl);
  const cardPath = resolveAgentCardPath(agentUrl);
  return `${normalizeBaseUrl(agentUrl)}/${cardPath}`;
}

function buildAgentCardUrl(hostUrl: string, agentId?: string): string {
  const base = normalizeAllowedHost(hostUrl);
  if (agentId !== undefined) {
    const safeAgentId = validateAgentId(agentId);
    return new URL(`/agents/${safeAgentId}/agent-card.json`, `${base}/`).href;
  }
  return new URL('/.well-known/agent-card.json', `${base}/`).href;
}

function parseServiceUrl(serviceUrl: string): { hostUrl: string; agentId?: string } {
  let url: URL;
  try {
    url = new URL(normalizeBaseUrl(serviceUrl));
  } catch {
    throw new Error('Invalid agent service URL');
  }
  assertAllowedOrigin(url);

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'agents' && segments[1]) {
    return {
      hostUrl: url.origin,
      agentId: validateAgentId(segments[1]),
    };
  }

  return { hostUrl: normalizeBaseUrl(serviceUrl) };
}

export async function fetchAgentCardForHost(hostUrl: string, agentId?: string): Promise<AgentCard> {
  const cardUrl = buildAgentCardUrl(hostUrl, agentId);
  const response = await fetch(cardUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Agent card fetch failed (HTTP ${response.status})`);
  }
  return readJsonResponse<AgentCard>(response, 'Agent card');
}

export async function fetchAgentCard(serviceUrl: string): Promise<AgentCard> {
  const { hostUrl, agentId } = parseServiceUrl(serviceUrl);
  return fetchAgentCardForHost(hostUrl, agentId);
}

export async function fetchAgentCardAt(cardUrl: string): Promise<AgentCard> {
  let url: URL;
  try {
    url = new URL(cardUrl);
  } catch {
    throw new Error('Invalid agent card URL');
  }
  assertAllowedOrigin(url);

  const agentMatch = /^\/agents\/([a-z0-9-]+)\/agent-card\.json$/.exec(url.pathname);
  if (agentMatch) {
    return fetchAgentCardForHost(url.origin, agentMatch[1]);
  }
  if (url.pathname === '/.well-known/agent-card.json') {
    return fetchAgentCardForHost(url.origin);
  }
  throw new Error('Invalid agent card URL path');
}
