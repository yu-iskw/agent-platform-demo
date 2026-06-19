import { sendAgentMessage } from '@agent-platform/agent-client';

import { resolveAgentServiceUrl } from './agent-url';

import type { AppSession } from './session-store';

export async function sendMessageViaRemoteAgent(
  session: AppSession,
  message: string,
  agentId = 'bigquery',
): Promise<string> {
  const agentUrl = resolveAgentServiceUrl(agentId);

  return sendAgentMessage({
    agentUrl,
    userMessage: message,
    caller: { googleAccessToken: session.googleAccessToken },
    demoMode: 'agent',
  });
}
