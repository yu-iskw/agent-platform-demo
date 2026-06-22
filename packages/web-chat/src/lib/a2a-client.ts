import { executeAgentMessageSend } from '@agent-platform/agent-client';

import { resolveAgentHostUrl, resolveAgentServiceUrl } from './agent-url';
import { runWithAuthProfile, type AuthProbePreset } from './auth-probe';

import type { AppSession } from './session-store';
import type { DemoAction, DemoMode } from '@agent-platform/agent-client';

export type SendRemoteAgentOptions = {
  session: AppSession;
  message: string;
  agentId?: string;
  demoMode?: DemoMode;
  demoAction?: DemoAction;
  demoProjectId?: string;
};

export type SendProofWithAuthProfileOptions = SendRemoteAgentOptions & {
  authPreset: AuthProbePreset;
};

export async function sendProofWithAuthProfile(
  options: SendProofWithAuthProfileOptions,
): Promise<string> {
  const {
    authPreset,
    session,
    message,
    agentId = 'bigquery',
    demoMode = 'direct',
    demoAction,
    demoProjectId,
  } = options;
  const agentUrl = resolveAgentServiceUrl(agentId);
  const hostUrl = resolveAgentHostUrl();

  return runWithAuthProfile(authPreset, hostUrl, session.googleAccessToken, async () =>
    executeAgentMessageSend({
      agentUrl,
      userMessage: message,
      demoMode,
      demoAction,
      demoProjectId,
    }),
  );
}

export async function sendMessageViaRemoteAgent(options: SendRemoteAgentOptions): Promise<string> {
  return sendProofWithAuthProfile({
    ...options,
    authPreset: 'full',
  });
}
