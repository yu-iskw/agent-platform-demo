export type AgentSelectionCandidate = {
  id: string;
};

export type AgentPolicyEntry = {
  id: string;
  enabled: boolean;
};

function enabledPolicyIds(policy: AgentPolicyEntry[]): Set<string> | null {
  if (policy.length === 0) {
    return null;
  }
  return new Set(policy.filter((entry) => entry.enabled).map((entry) => entry.id));
}

function filterDiscoveredByPolicy<T extends AgentSelectionCandidate>(
  discovered: T[],
  enabledIds: Set<string> | null,
): T[] {
  if (enabledIds === null) {
    return discovered;
  }
  return discovered.filter((agent) => enabledIds.has(agent.id));
}

/** Pick an agent id that is both discovered (when present) and enabled in runtime policy. */
export function pickEnabledAgentId(
  current: string,
  discovered: AgentSelectionCandidate[],
  policy: AgentPolicyEntry[],
): string {
  const enabledIds = enabledPolicyIds(policy);
  const selectable = filterDiscoveredByPolicy(discovered, enabledIds);

  if (selectable.some((agent) => agent.id === current)) {
    return current;
  }
  if (selectable.length > 0) {
    return selectable[0].id;
  }

  const enabledInPolicy = policy.filter((entry) => entry.enabled);
  if (enabledInPolicy.some((entry) => entry.id === current)) {
    return current;
  }
  return enabledInPolicy[0]?.id ?? '';
}
