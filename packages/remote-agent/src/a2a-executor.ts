import { extractTextFromMessage, parseA2aDemoMetadata } from '@agent-platform/mcp-auth';

import { runAgentPrompt } from './agent.js';
import { runDirectTool } from './direct-tools.js';

import type { AgentCard } from '@a2a-js/sdk';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';

export class BigQueryAgentExecutor implements AgentExecutor {
  async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    try {
      const demo = parseA2aDemoMetadata(context.userMessage);
      let responseText: string;

      if (demo.mode === 'direct') {
        if (!demo.action) {
          throw new Error('Direct tool mode requires demo.action metadata');
        }
        responseText = await runDirectTool(demo.action, demo.projectId);
      } else {
        const userText = extractTextFromMessage(context.userMessage) ?? '';
        responseText = await runAgentPrompt(userText);
      }

      eventBus.publish({
        kind: 'message' as const,
        messageId: crypto.randomUUID(),
        role: 'agent' as const,
        parts: [{ kind: 'text' as const, text: responseText }],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent execution failed';
      eventBus.publish({
        kind: 'message' as const,
        messageId: crypto.randomUUID(),
        role: 'agent' as const,
        parts: [{ kind: 'text' as const, text: `Error: ${message}` }],
      });
    } finally {
      eventBus.finished();
    }
  }

  cancelTask(_taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    eventBus.finished();
    return Promise.resolve();
  }
}

export function buildAgentCard(baseUrl: string): AgentCard {
  return {
    name: 'BigQuery Assistant',
    description: 'Helps list BigQuery datasets using user-delegated credentials via MCP.',
    url: baseUrl,
    version: '0.1.0',
    capabilities: {
      streaming: false,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    securitySchemes: {
      google: {
        type: 'openIdConnect',
        openIdConnectUrl: 'https://accounts.google.com/.well-known/openid-configuration',
      },
    },
    security: [{ google: [] }],
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
