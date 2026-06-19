import { normalizeBaseUrl } from '@agent-platform/agent-client';

import { createAgentExecutor } from './agent-executor.js';
import { runBigQueryAgentPrompt, runGeneralAgentPrompt } from './agent.js';
import { buildBigQueryAgentCard, buildGeneralAgentCard } from './demo-agent-cards.js';
import { runDirectTool } from './direct-tools.js';

import type { AgentDefinition } from '@agent-platform/a2a-server';

function agentServiceUrl(publicBaseUrl: string, mountPath: string): string {
  return `${normalizeBaseUrl(publicBaseUrl)}${mountPath}`;
}

export function getAgentDefinitions(): AgentDefinition[] {
  return [
    {
      id: 'bigquery',
      mountPath: '/agents/bigquery',
      legacyRoot: true,
      buildCard: (publicBaseUrl) =>
        buildBigQueryAgentCard(agentServiceUrl(publicBaseUrl, '/agents/bigquery')),
      buildLegacyCard: (publicBaseUrl) => buildBigQueryAgentCard(normalizeBaseUrl(publicBaseUrl)),
      createExecutor: () =>
        createAgentExecutor(runBigQueryAgentPrompt, {
          allowDirectTools: true,
          runDirectTool,
        }),
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
