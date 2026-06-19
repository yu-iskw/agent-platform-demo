import {
  buildBigQueryAgentCard,
  buildGeneralAgentCard,
  createAgentExecutor,
} from './a2a-executor.js';
import { runBigQueryAgentPrompt, runGeneralAgentPrompt } from './agent.js';

import type { AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor } from '@a2a-js/sdk/server';

export type AgentDefinition = {
  id: string;
  mountPath: string;
  legacyRoot?: boolean;
  buildCard: (publicBaseUrl: string) => AgentCard;
  createExecutor: () => AgentExecutor;
};

function agentServiceUrl(publicBaseUrl: string, mountPath: string): string {
  return `${publicBaseUrl.replace(/\/$/, '')}${mountPath}`;
}

export function getAgentDefinitions(): AgentDefinition[] {
  return [
    {
      id: 'bigquery',
      mountPath: '/agents/bigquery',
      legacyRoot: true,
      buildCard: (publicBaseUrl) =>
        buildBigQueryAgentCard(agentServiceUrl(publicBaseUrl, '/agents/bigquery')),
      createExecutor: () => createAgentExecutor(runBigQueryAgentPrompt, { allowDirectTools: true }),
    },
    {
      id: 'general',
      mountPath: '/agents/general',
      buildCard: (publicBaseUrl) =>
        buildGeneralAgentCard(agentServiceUrl(publicBaseUrl, '/agents/general')),
      createExecutor: () => createAgentExecutor(runGeneralAgentPrompt),
    },
  ];
}
