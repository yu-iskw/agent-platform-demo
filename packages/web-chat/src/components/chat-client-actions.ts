import type { AuthProbeResult } from '@/lib/auth-probe';
import type { AuthProbePreset, AuthTraceInput } from '@/lib/auth-trace';
import { parseHttpStatusFromError } from '@/lib/auth-trace';
import { readJsonResponse } from '@/lib/read-json-response';

import type { DemoAction, DemoMode } from '@agent-platform/agent-client';

type ChatResponse = {
  reply?: string;
  useRemoteAgent?: boolean;
  demoMode?: DemoMode;
  agentId?: string;
  routed?: boolean;
  selectedAgentId?: string;
  authPreset?: AuthProbePreset;
  error?: string;
};

type AgentSummary = { id: string; name: string };

export type ChatRequestContext = {
  useRemoteAgent: boolean;
  authPreset: AuthProbePreset;
  selectedAgentId: string;
  agents: AgentSummary[];
  policyAgents: AgentSummary[];
};

export type ChatRequestCallbacks = {
  onStart: () => void;
  onSuccess: (result: {
    reply: string;
    useRemoteAgent: boolean;
    demoMode: DemoMode | null;
    routed: boolean;
    agentName: string | null;
    clearMessage: boolean;
  }) => void;
  onError: (message: string) => void;
  onTrace: (trace: AuthTraceInput) => void;
  onFinish: () => void;
};

function resolveProofAgentId(demoAction: DemoAction | undefined, selectedAgentId: string): string {
  return demoAction ? selectedAgentId || 'bigquery' : selectedAgentId;
}

function resolveReplyAgentName(
  context: ChatRequestContext,
  data: ChatResponse,
  useRemoteAgent: boolean,
): string | null {
  if (!useRemoteAgent) {
    return null;
  }
  const replyAgent =
    context.agents.find((agent) => agent.id === data.agentId) ??
    context.policyAgents.find((agent) => agent.id === data.agentId);
  return replyAgent?.name ?? data.agentId ?? context.selectedAgentId;
}

export async function postChatRequest(
  input: { message: string; demoAction?: DemoAction },
  context: ChatRequestContext,
  callbacks: ChatRequestCallbacks,
): Promise<void> {
  callbacks.onStart();

  let httpOk = false;
  let responseError: string | null = null;
  let responseReply: string | null = null;
  let responseUseRemote = context.useRemoteAgent;
  let responseDemoMode: DemoMode | null = null;
  let responseAuthPreset: AuthProbePreset | null = context.useRemoteAgent
    ? context.authPreset
    : null;
  let responseHttpStatus: number | null = null;

  try {
    const proofAgentId = resolveProofAgentId(input.demoAction, context.selectedAgentId);
    const endpoint = input.demoAction ? '/api/chat-proof' : '/api/chat';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input.message,
        agentId: proofAgentId,
        ...(context.useRemoteAgent ? { authPreset: context.authPreset } : {}),
        ...(input.demoAction ? { demoAction: input.demoAction } : {}),
      }),
    });
    const data = await readJsonResponse<ChatResponse>(response, 'Chat API');
    httpOk = response.ok;
    responseAuthPreset = data.authPreset ?? (context.useRemoteAgent ? context.authPreset : null);
    responseHttpStatus = response.ok
      ? response.status
      : (parseHttpStatusFromError(data.error ?? null) ?? response.status);

    if (!response.ok) {
      throw new Error(data.error ?? 'Request failed');
    }

    responseReply = data.reply ?? '';
    responseUseRemote = data.useRemoteAgent ?? context.useRemoteAgent;
    responseDemoMode = data.demoMode ?? null;

    callbacks.onSuccess({
      reply: responseReply,
      useRemoteAgent: responseUseRemote,
      demoMode: responseDemoMode,
      routed: Boolean(data.routed),
      agentName: resolveReplyAgentName(context, data, responseUseRemote),
      clearMessage: !input.demoAction,
    });
  } catch (submitError) {
    httpOk = false;
    responseError = submitError instanceof Error ? submitError.message : 'Unknown error';
    responseHttpStatus = parseHttpStatusFromError(responseError);
    callbacks.onError(responseError);
  } finally {
    callbacks.onTrace({
      useRemoteAgent: responseUseRemote,
      demoMode: responseDemoMode,
      httpOk,
      httpStatus: responseHttpStatus,
      error: responseError,
      reply: responseReply,
      probePreset: responseAuthPreset,
    });
    callbacks.onFinish();
  }
}

export type AuthProbeCallbacks = {
  onStart: () => void;
  onError: (message: string) => void;
  onTrace: (trace: AuthTraceInput) => void;
  onFinish: () => void;
};

export async function postAuthProbe(
  authPreset: AuthProbePreset,
  callbacks: AuthProbeCallbacks,
): Promise<void> {
  callbacks.onStart();

  let httpOk = false;
  let responseError: string | null = null;
  let responseHttpStatus: number | null = null;

  try {
    const response = await fetch('/api/auth-probe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset: authPreset }),
    });
    const data = await readJsonResponse<AuthProbeResult & { error?: string }>(
      response,
      'Auth probe API',
    );

    if (!response.ok) {
      throw new Error(data.error || 'Probe failed');
    }

    httpOk = data.ok;
    responseHttpStatus = data.httpStatus;
    responseError = data.ok ? null : data.error || `HTTP ${data.httpStatus}`;
  } catch (probeError) {
    httpOk = false;
    responseError = probeError instanceof Error ? probeError.message : 'Probe failed';
    responseHttpStatus = parseHttpStatusFromError(responseError);
    callbacks.onError(responseError);
  } finally {
    callbacks.onTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk,
      httpStatus: responseHttpStatus,
      error: responseError,
      reply: null,
      probePreset: authPreset,
    });
    callbacks.onFinish();
  }
}
