import { getAgentDefinitions } from './agent-definitions.js';

export type AgentPolicyItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

const enabledById = new Map<string, boolean>();
const metadataById = new Map<string, { name: string; description: string }>();

function assertKnownAgentId(id: string): void {
  const known = getAgentDefinitions().some((definition) => definition.id === id);
  if (!known) {
    throw new Error(`Unknown agent: ${id}`);
  }
}

export function initAgentPolicy(publicBaseUrl: string): void {
  enabledById.clear();
  metadataById.clear();

  for (const definition of getAgentDefinitions()) {
    const card = definition.buildCard(publicBaseUrl);
    metadataById.set(definition.id, {
      name: card.name,
      description: card.description,
    });
    enabledById.set(definition.id, true);
  }
}

export function isAgentEnabled(id: string): boolean {
  return enabledById.get(id) ?? false;
}

export function setAgentEnabled(id: string, enabled: boolean): void {
  assertKnownAgentId(id);
  enabledById.set(id, enabled);
}

export function listAgentPolicy(): AgentPolicyItem[] {
  return getAgentDefinitions().map((definition) => {
    const metadata = metadataById.get(definition.id);
    return {
      id: definition.id,
      name: metadata?.name ?? definition.id,
      description: metadata?.description ?? '',
      enabled: isAgentEnabled(definition.id),
    };
  });
}

export function getEnabledAgentDefinitions(): ReturnType<typeof getAgentDefinitions> {
  return getAgentDefinitions().filter((definition) => isAgentEnabled(definition.id));
}
