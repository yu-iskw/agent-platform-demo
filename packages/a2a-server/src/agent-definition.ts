import type { AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor } from '@a2a-js/sdk/server';

export type AgentDefinition = {
  id: string;
  mountPath: string;
  legacyRoot?: boolean;
  buildCard: (publicBaseUrl: string) => AgentCard;
  buildLegacyCard?: (publicBaseUrl: string) => AgentCard;
  createExecutor: () => AgentExecutor;
};
