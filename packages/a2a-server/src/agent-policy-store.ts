import type { AgentDefinition } from './agent-definition.js';

export type AgentPolicyItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type AgentPolicyStore = {
  list(): AgentPolicyItem[];
  isEnabled(id: string): boolean;
  setEnabled(id: string, enabled: boolean): void;
  getEnabledDefinitions(): AgentDefinition[];
};

export function createAgentPolicyStore(
  definitions: AgentDefinition[],
  publicBaseUrl: string,
): AgentPolicyStore {
  const enabledById = new Map<string, boolean>();
  const metadataById = new Map<string, { name: string; description: string }>();

  function assertKnownAgentId(id: string): void {
    const known = definitions.some((definition) => definition.id === id);
    if (!known) {
      throw new Error(`Unknown agent: ${id}`);
    }
  }

  enabledById.clear();
  metadataById.clear();

  for (const definition of definitions) {
    const card = definition.buildCard(publicBaseUrl);
    metadataById.set(definition.id, {
      name: card.name,
      description: card.description,
    });
    enabledById.set(definition.id, true);
  }

  return {
    list(): AgentPolicyItem[] {
      return definitions.map((definition) => {
        const metadata = metadataById.get(definition.id);
        return {
          id: definition.id,
          name: metadata?.name ?? definition.id,
          description: metadata?.description ?? '',
          enabled: enabledById.get(definition.id) ?? false,
        };
      });
    },

    isEnabled(id: string): boolean {
      return enabledById.get(id) ?? false;
    },

    setEnabled(id: string, enabled: boolean): void {
      assertKnownAgentId(id);
      enabledById.set(id, enabled);
    },

    getEnabledDefinitions(): AgentDefinition[] {
      return definitions.filter((definition) => enabledById.get(definition.id) ?? false);
    },
  };
}
