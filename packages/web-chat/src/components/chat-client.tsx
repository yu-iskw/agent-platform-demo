'use client';

import { useEffect, useState } from 'react';

import { AppShell } from '@/components/app-shell';
import { ControlPlane } from '@/components/control-plane';
import { OperationPlane } from '@/components/operation-plane';
import { useRemoteAgentData } from '@/components/use-remote-agent-data';
import type { AuthProbeResult } from '@/lib/auth-probe';
import {
  parseHttpStatusFromError,
  type AuthProbePreset,
  type AuthTraceInput,
} from '@/lib/auth-trace';
import { persistMode } from '@/lib/persist-mode';
import { readJsonResponse } from '@/lib/read-json-response';

import type { DemoAction, DemoMode } from '@agent-platform/agent-client';
import type { FormEvent } from 'react';

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

const chatModeApiLabel = 'Chat mode API';
const demoModeApiLabel = 'Demo mode API';
const demoModeApiPath = '/api/demo-mode';
const demoModeUpdateError = 'Failed to update demo mode';
const authProbeApiLabel = 'Auth probe API';

function isRemoteSendBlocked(
  useRemoteAgent: boolean,
  remote: ReturnType<typeof useRemoteAgentData>,
): boolean {
  if (!useRemoteAgent) {
    return false;
  }
  if (remote.policyLoading || remote.agentsLoading) {
    return true;
  }
  return remote.policyAgents.length > 0 && !remote.policyAgents.some((agent) => agent.enabled);
}

export default function ChatClient(): React.JSX.Element {
  const [useRemoteAgent, setUseRemoteAgent] = useState(false);
  const [demoMode, setDemoMode] = useState<DemoMode>('agent');
  const remote = useRemoteAgentData(useRemoteAgent);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [replyAgentName, setReplyAgentName] = useState<string | null>(null);
  const [replyViaRemote, setReplyViaRemote] = useState<boolean | null>(null);
  const [replyDemoMode, setReplyDemoMode] = useState<DemoMode | null>(null);
  const [replyRouted, setReplyRouted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [authTraceInput, setAuthTraceInput] = useState<AuthTraceInput | null>(null);
  const [authPreset, setAuthPreset] = useState<AuthProbePreset>('full');
  const [probing, setProbing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [chatResponse, demoResponse] = await Promise.all([
          fetch('/api/chat-mode'),
          fetch(demoModeApiPath),
        ]);
        if (chatResponse.ok) {
          const chatData = await readJsonResponse<{ mode?: 'local' | 'remote' }>(
            chatResponse,
            chatModeApiLabel,
          );
          setUseRemoteAgent(chatData.mode === 'remote');
        }
        if (demoResponse.ok) {
          const demoData = await readJsonResponse<{ mode?: DemoMode }>(
            demoResponse,
            demoModeApiLabel,
          );
          setDemoMode(demoData.mode === 'direct' ? 'direct' : 'agent');
        }
      } catch {
        // Keep defaults when session cookie is unavailable.
      }
    })();
  }, []);

  const selectedAgent =
    remote.agents.find((agent) => agent.id === remote.selectedAgentId) ??
    remote.policyAgents.find((agent) => agent.id === remote.selectedAgentId);

  const showDirectProofControls = useRemoteAgent && !remote.policyLoading;

  const policyUnavailable =
    useRemoteAgent &&
    !remote.policyLoading &&
    !remote.selectedAgentId &&
    Boolean(remote.policyError);

  async function sendChatRequest(input: {
    message: string;
    demoAction?: DemoAction;
  }): Promise<void> {
    setLoading(true);
    setError(null);
    setReply(null);
    setReplyAgentName(null);
    setReplyViaRemote(null);
    setReplyDemoMode(null);
    setReplyRouted(false);

    let httpOk = false;
    let responseError: string | null = null;
    let responseReply: string | null = null;
    let responseUseRemote = useRemoteAgent;
    let responseDemoMode: DemoMode | null = null;

    let responseAuthPreset: AuthProbePreset | null = useRemoteAgent ? authPreset : null;
    let responseHttpStatus: number | null = null;

    try {
      const proofAgentId = input.demoAction
        ? remote.selectedAgentId || 'bigquery'
        : remote.selectedAgentId;
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.message,
          agentId: proofAgentId,
          ...(useRemoteAgent ? { authPreset } : {}),
          ...(input.demoAction ? { demoAction: input.demoAction } : {}),
        }),
      });
      const data = await readJsonResponse<ChatResponse>(response, 'Chat API');
      httpOk = response.ok;
      responseAuthPreset = data.authPreset ?? (useRemoteAgent ? authPreset : null);
      responseHttpStatus = response.ok
        ? response.status
        : (parseHttpStatusFromError(data.error ?? null) ?? response.status);

      if (!response.ok) {
        throw new Error(data.error ?? 'Request failed');
      }

      responseReply = data.reply ?? '';
      responseUseRemote = data.useRemoteAgent ?? useRemoteAgent;
      responseDemoMode = data.demoMode ?? null;

      setReply(responseReply);
      setReplyViaRemote(responseUseRemote);
      setReplyDemoMode(responseDemoMode);
      setReplyRouted(Boolean(data.routed));
      if (responseUseRemote) {
        const replyAgent =
          remote.agents.find((agent) => agent.id === data.agentId) ??
          remote.policyAgents.find((agent) => agent.id === data.agentId);
        setReplyAgentName(replyAgent?.name ?? data.agentId ?? remote.selectedAgentId);
      }
      if (!input.demoAction) {
        setMessage('');
      }
    } catch (submitError) {
      httpOk = false;
      responseError = submitError instanceof Error ? submitError.message : 'Unknown error';
      responseHttpStatus = parseHttpStatusFromError(responseError);
      setError(responseError);
    } finally {
      setAuthTraceInput({
        useRemoteAgent: responseUseRemote,
        demoMode: responseDemoMode,
        httpOk,
        httpStatus: responseHttpStatus,
        error: responseError,
        reply: responseReply,
        probePreset: responseAuthPreset,
      });
      setLoading(false);
    }
  }

  async function runAuthProbe(): Promise<void> {
    setProbing(true);
    setError(null);

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
        authProbeApiLabel,
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
      setError(responseError);
    } finally {
      setAuthTraceInput({
        useRemoteAgent: true,
        demoMode: null,
        httpOk,
        httpStatus: responseHttpStatus,
        error: responseError,
        reply: null,
        probePreset: authPreset,
      });
      setProbing(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void sendChatRequest({ message });
  }

  function handleChatModeChange(remoteEnabled: boolean): void {
    setModeError(null);
    setUseRemoteAgent(remoteEnabled);
    const tasks = [
      persistMode('/api/chat-mode', remoteEnabled ? 'remote' : 'local', {
        apiLabel: chatModeApiLabel,
        defaultError: 'Failed to update chat mode',
      }),
    ];
    if (!remoteEnabled) {
      setDemoMode('agent');
      tasks.push(
        persistMode(demoModeApiPath, 'agent', {
          apiLabel: demoModeApiLabel,
          defaultError: demoModeUpdateError,
        }),
      );
    }
    void Promise.all(tasks).catch((modeUpdateError) => {
      setModeError(
        modeUpdateError instanceof Error ? modeUpdateError.message : 'Failed to update mode',
      );
    });
  }

  function handleDemoModeChange(mode: DemoMode): void {
    setModeError(null);
    setDemoMode(mode);
    void persistMode(demoModeApiPath, mode, {
      apiLabel: demoModeApiLabel,
      defaultError: demoModeUpdateError,
    }).catch((modeUpdateError) => {
      setModeError(
        modeUpdateError instanceof Error ? modeUpdateError.message : demoModeUpdateError,
      );
    });
  }

  function handleAgentSelect(agentId: string): void {
    remote.setSelectedAgentId(agentId);
    if (agentId !== 'bigquery' && demoMode === 'direct') {
      setDemoMode('agent');
      void persistMode(demoModeApiPath, 'agent', {
        apiLabel: demoModeApiLabel,
        defaultError: demoModeUpdateError,
      }).catch(() => {
        // Non-fatal; server downgrades direct mode on routing anyway.
      });
    }
  }

  const authProfileBlocksSend = useRemoteAgent && authPreset !== 'full';
  const remoteBusy = useRemoteAgent && (remote.policyLoading || remote.agentsLoading);
  const remoteBlocked = isRemoteSendBlocked(useRemoteAgent, remote);
  const sendDisabled =
    loading || message.trim().length === 0 || remoteBusy || remoteBlocked || authProfileBlocksSend;

  return (
    <AppShell
      control={
        <ControlPlane
          useRemoteAgent={useRemoteAgent}
          demoMode={demoMode}
          modeError={modeError}
          loading={loading}
          remote={remote}
          selectedAgentName={selectedAgent?.name ?? remote.selectedAgentId}
          showDirectProofControls={showDirectProofControls}
          onChatModeChange={handleChatModeChange}
          onDemoModeChange={handleDemoModeChange}
          onProofAction={(action, proofMessage) => {
            void sendChatRequest({ message: proofMessage, demoAction: action });
          }}
          onAgentSelect={handleAgentSelect}
          authPreset={authPreset}
          probing={probing}
          onAuthPresetChange={setAuthPreset}
          onRunAuthProbe={() => {
            void runAuthProbe();
          }}
        />
      }
      operation={
        <OperationPlane
          useRemoteAgent={useRemoteAgent}
          selectedAgentId={remote.selectedAgentId}
          demoMode={demoMode}
          message={message}
          reply={reply}
          replyAgentName={replyAgentName}
          replyViaRemote={replyViaRemote}
          replyDemoMode={replyDemoMode}
          replyRouted={replyRouted}
          error={error}
          loading={loading}
          sendDisabled={sendDisabled}
          authProfileBlocksSend={authProfileBlocksSend}
          policyUnavailable={policyUnavailable}
          authTraceInput={authTraceInput}
          onMessageChange={setMessage}
          onSubmit={onSubmit}
        />
      }
    />
  );
}
