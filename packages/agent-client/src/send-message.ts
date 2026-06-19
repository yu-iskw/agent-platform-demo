import { A2AClient } from '@a2a-js/sdk/client';

import { buildA2aDemoMetadata, type DemoAction, type DemoMode } from './a2a-demo-metadata.js';
import { resolveAgentCardUrl } from './fetch-agent-card.js';
import { parseSendMessageResponse } from './parse-response.js';
import { runWithUserAuthorization } from './session-fetch.js';

export type AgentCallerCredentials = {
  googleAccessToken: string;
};

export type SendAgentMessageOptions = {
  agentUrl: string;
  userMessage: string;
  caller: AgentCallerCredentials;
  demoMode?: DemoMode;
  demoAction?: DemoAction;
  demoProjectId?: string;
};

export async function sendAgentMessage(options: SendAgentMessageOptions): Promise<string> {
  const demoMode = options.demoMode ?? 'agent';

  return runWithUserAuthorization(options.caller.googleAccessToken, options.agentUrl, async () => {
    const client = await A2AClient.fromCardUrl(resolveAgentCardUrl(options.agentUrl));
    const response = await client.sendMessage({
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        parts: [{ kind: 'text', text: options.userMessage }],
        metadata: buildA2aDemoMetadata({
          mode: demoMode,
          action: options.demoAction,
          projectId: options.demoProjectId,
        }),
      },
    });

    return parseSendMessageResponse(response);
  });
}
