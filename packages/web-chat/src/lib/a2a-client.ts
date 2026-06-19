import { sendAgentMessage } from '@agent-platform/agent-client';

import type { AppSession } from './session-store.js';

export async function sendMessageViaRemoteAgent(
  session: AppSession,
  message: string,
): Promise<string> {
  const agentUrl = process.env.AGENT_URL ?? 'http://127.0.0.1:8081';

  return sendAgentMessage({
    agentUrl,
    userMessage: message,
    caller: { googleAccessToken: session.googleAccessToken },
    demoMode: 'agent',
  });
}
