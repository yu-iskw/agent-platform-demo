import { normalizeBaseUrl } from '@agent-platform/agent-client';

import type { AgentDefinition } from './agent-definition.js';
import type { AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor } from '@a2a-js/sdk/server';

export const TEST_BASE_URL = 'https://example.run.app';

const stubExecutor: AgentExecutor = {
  execute: (_context, eventBus) => {
    eventBus.finished();
    return Promise.resolve();
  },
  cancelTask: (_taskId, eventBus) => {
    eventBus.finished();
    return Promise.resolve();
  },
};

function buildStubCard(id: string, baseUrl: string): AgentCard {
  return {
    protocolVersion: '0.3.0',
    name: `${id} agent`,
    description: `${id} description`,
    url: baseUrl,
    version: '0.1.0',
    capabilities: { streaming: false },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    skills: [],
  };
}

export const testDefinitions: AgentDefinition[] = [
  {
    id: 'bigquery',
    mountPath: '/agents/bigquery',
    legacyRoot: true,
    buildCard: (publicBaseUrl) =>
      buildStubCard('bigquery', `${normalizeBaseUrl(publicBaseUrl)}/agents/bigquery`),
    buildLegacyCard: (publicBaseUrl) => buildStubCard('bigquery', normalizeBaseUrl(publicBaseUrl)),
    createExecutor: () => stubExecutor,
  },
  {
    id: 'general',
    mountPath: '/agents/general',
    buildCard: (publicBaseUrl) =>
      buildStubCard('general', `${normalizeBaseUrl(publicBaseUrl)}/agents/general`),
    createExecutor: () => stubExecutor,
  },
];
