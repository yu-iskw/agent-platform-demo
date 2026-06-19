import type { AgentPolicyEntry } from './pick-enabled-agent-id.js';

const BIGQUERY_INTENT_PATTERN =
  /\b(bigquery|datasets?|dataset\s+list|list\s+datasets|ubie-yu-sandbox|gcp\s+project)\b/i;

export function looksLikeBigQueryRequest(message: string): boolean {
  return BIGQUERY_INTENT_PATTERN.test(message);
}

export type ResolvedChatAgent = {
  agentId: string;
  /** True when a different enabled agent was chosen than the UI selection. */
  routed: boolean;
};

/** Pick an enabled A2A agent for a chat message (availability + intent, not card selection alone). */
export function resolveChatAgentId(
  message: string,
  selectedAgentId: string,
  policy: AgentPolicyEntry[],
): ResolvedChatAgent {
  const enabled = policy.filter((entry) => entry.enabled);
  const enabledIds = new Set(enabled.map((entry) => entry.id));

  if (enabledIds.size === 0) {
    throw new Error(`Agent "${selectedAgentId}" is not enabled or not available`);
  }

  if (enabledIds.has('bigquery') && looksLikeBigQueryRequest(message)) {
    const agentId = 'bigquery';
    return { agentId, routed: agentId !== selectedAgentId };
  }

  if (enabledIds.has(selectedAgentId)) {
    return { agentId: selectedAgentId, routed: false };
  }

  const fallback = enabled[0]?.id ?? selectedAgentId;
  if (!enabledIds.has(fallback)) {
    throw new Error(`Agent "${fallback}" is not enabled or not available`);
  }
  return { agentId: fallback, routed: fallback !== selectedAgentId };
}
