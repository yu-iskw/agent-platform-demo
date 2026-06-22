import { normalizeBaseUrl } from './fetch-agent-card.js';
import { readJsonResponse } from './read-json-response.js';

export type AgentPolicyItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type AgentPolicyResponse = {
  agents: AgentPolicyItem[];
};

function parseAgentPolicyEntry(agent: unknown): AgentPolicyItem {
  if (typeof agent !== 'object' || agent === null) {
    throw new Error('Invalid agent policy entry');
  }

  const entry = agent as Record<string, unknown>;
  const id = entry.id;
  const enabled = entry.enabled;

  if (typeof id !== 'string' || !id || typeof enabled !== 'boolean') {
    throw new Error('Invalid agent policy entry');
  }

  return {
    id,
    name: typeof entry.name === 'string' ? entry.name : id,
    description: typeof entry.description === 'string' ? entry.description : '',
    enabled,
  };
}

export function parseAgentPolicyResponse(body: unknown): AgentPolicyItem[] {
  if (!body || typeof body !== 'object' || !('agents' in body)) {
    throw new Error('Agent policy response missing agents');
  }

  const { agents } = body as AgentPolicyResponse;
  if (!Array.isArray(agents)) {
    throw new Error('Agent policy response missing agents');
  }

  return agents.map((agent) => parseAgentPolicyEntry(agent));
}

export async function fetchAgentPolicy(hostUrl: string): Promise<AgentPolicyItem[]> {
  const policyUrl = `${normalizeBaseUrl(hostUrl)}/agent-policy`;
  const response = await fetch(policyUrl);
  if (!response.ok) {
    throw new Error(`Agent policy fetch failed (HTTP ${response.status})`);
  }

  const body = await readJsonResponse<AgentPolicyResponse>(response, 'Agent policy');
  return parseAgentPolicyResponse(body);
}

export async function updateAgentPolicy(
  hostUrl: string,
  update: { agentId: string; enabled: boolean },
): Promise<AgentPolicyItem[]> {
  const policyUrl = `${normalizeBaseUrl(hostUrl)}/agent-policy`;
  const response = await fetch(policyUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error(`Agent policy update failed (HTTP ${response.status})`);
  }

  const body = await readJsonResponse<AgentPolicyResponse>(response, 'Agent policy');
  return parseAgentPolicyResponse(body);
}
