import { extractTextFromMessage, parseA2aDemoMetadata } from '@agent-platform/agent-client';

import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import type { DemoAction } from '@agent-platform/agent-client';

export type CreateAgentExecutorOptions = {
  allowDirectTools?: boolean;
  runDirectTool?: (action: DemoAction, projectId: string | undefined) => Promise<string>;
};

export function createAgentExecutor(
  runPrompt: (userMessage: string) => Promise<string>,
  options?: CreateAgentExecutorOptions,
): AgentExecutor {
  const allowDirectTools = options?.allowDirectTools ?? false;
  const runDirectToolFn = options?.runDirectTool;

  if (allowDirectTools && !runDirectToolFn) {
    throw new Error('runDirectTool is required when allowDirectTools is true');
  }

  return {
    async execute(context: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
      try {
        const demo = parseA2aDemoMetadata(context.userMessage);
        let responseText: string;

        if (demo.mode === 'direct') {
          if (!allowDirectTools) {
            throw new Error('Direct tool mode is not supported for this agent');
          }
          if (!demo.action) {
            throw new Error('Direct tool mode requires demo.action metadata');
          }
          responseText = await runDirectToolFn!(demo.action, demo.projectId);
        } else {
          const userText = extractTextFromMessage(context.userMessage) ?? '';
          responseText = await runPrompt(userText);
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
    },

    cancelTask(_taskId: string, eventBus: ExecutionEventBus): Promise<void> {
      eventBus.finished();
      return Promise.resolve();
    },
  };
}
