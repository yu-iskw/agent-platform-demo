import type { AgentCard } from '@a2a-js/sdk';

const GOOGLE_SECURITY = {
  securitySchemes: {
    google: {
      type: 'openIdConnect' as const,
      openIdConnectUrl: 'https://accounts.google.com/.well-known/openid-configuration',
    },
  },
  security: [{ google: [] }],
};

export function buildBigQueryAgentCard(baseUrl: string): AgentCard {
  return {
    protocolVersion: '0.3.0',
    name: 'BigQuery Assistant',
    description: 'Helps list BigQuery datasets using user-delegated credentials via MCP.',
    url: baseUrl,
    version: '0.1.0',
    capabilities: {
      streaming: false,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    ...GOOGLE_SECURITY,
    skills: [
      {
        id: 'list-datasets',
        name: 'List datasets',
        description: 'List BigQuery datasets in a GCP project',
        tags: ['bigquery'],
      },
    ],
  };
}

export function buildGeneralAgentCard(baseUrl: string): AgentCard {
  return {
    protocolVersion: '0.3.0',
    name: 'General Assistant',
    description: 'General-purpose chat without BigQuery or MCP tools.',
    url: baseUrl,
    version: '0.1.0',
    capabilities: {
      streaming: false,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    ...GOOGLE_SECURITY,
    skills: [
      {
        id: 'general-chat',
        name: 'General chat',
        description: 'Answer questions in plain text without tool access',
        tags: ['chat'],
      },
    ],
  };
}
