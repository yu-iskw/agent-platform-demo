'use client';

import { useEffect, useState } from 'react';

import { postAuthProbe, postChatRequest } from '@/components/chat-client-actions';
import { useRemoteAgentData } from '@/components/use-remote-agent-data';
import type { AuthProbePreset, AuthTraceInput } from '@/lib/auth-trace';
import { persistMode } from '@/lib/persist-mode';

import type { DemoAction, DemoMode } from '@agent-platform/agent-client';
import type { FormEvent } from 'react';

const chatModeApiLabel = 'Chat mode API';

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

function resetReplyState(setters: {
  setReply: (value: string | null) => void;
  setReplyAgentName: (value: string | null) => void;
  setReplyViaRemote: (value: boolean | null) => void;
  setReplyDemoMode: (value: DemoMode | null) => void;
  setReplyRouted: (value: boolean) => void;
}): void {
  setters.setReply(null);
  setters.setReplyAgentName(null);
  setters.setReplyViaRemote(null);
  setters.setReplyDemoMode(null);
  setters.setReplyRouted(false);
}

export function useChatClient(): {
  useRemoteAgent: boolean;
  remote: ReturnType<typeof useRemoteAgentData>;
  message: string;
  reply: string | null;
  replyAgentName: string | null;
  replyViaRemote: boolean | null;
  replyDemoMode: DemoMode | null;
  replyRouted: boolean;
  error: string | null;
  loading: boolean;
  modeError: string | null;
  authTraceInput: AuthTraceInput | null;
  authPreset: AuthProbePreset;
  probing: boolean;
  selectedAgentName: string;
  showAuthProofControls: boolean;
  policyUnavailable: boolean;
  authProfileBlocksSend: boolean;
  sendDisabled: boolean;
  setMessage: (value: string) => void;
  setAuthPreset: (preset: AuthProbePreset) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleChatModeChange: (remoteEnabled: boolean) => void;
  handleAgentSelect: (agentId: string) => void;
  onProofAction: (action: DemoAction, proofMessage: string) => void;
  onRunAuthProbe: () => void;
} {
  const [useRemoteAgent, setUseRemoteAgent] = useState(false);
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
        const chatResponse = await fetch('/api/chat-mode');
        if (chatResponse.ok) {
          const chatData = (await chatResponse.json()) as { mode?: 'local' | 'remote' };
          setUseRemoteAgent(chatData.mode === 'remote');
        }
      } catch {
        // Keep defaults when session cookie is unavailable.
      }
    })();
  }, []);

  const selectedAgent =
    remote.agents.find((agent) => agent.id === remote.selectedAgentId) ??
    remote.policyAgents.find((agent) => agent.id === remote.selectedAgentId);

  const showAuthProofControls = useRemoteAgent && !remote.policyLoading;
  const policyUnavailable =
    useRemoteAgent &&
    !remote.policyLoading &&
    !remote.selectedAgentId &&
    Boolean(remote.policyError);

  function sendChatRequest(input: { message: string; demoAction?: DemoAction }): void {
    void postChatRequest(
      input,
      {
        useRemoteAgent,
        authPreset,
        selectedAgentId: remote.selectedAgentId,
        agents: remote.agents,
        policyAgents: remote.policyAgents,
      },
      {
        onStart: () => {
          setLoading(true);
          setError(null);
          resetReplyState({
            setReply,
            setReplyAgentName,
            setReplyViaRemote,
            setReplyDemoMode,
            setReplyRouted,
          });
        },
        onSuccess: (result) => {
          setReply(result.reply);
          setReplyViaRemote(result.useRemoteAgent);
          setReplyDemoMode(result.demoMode);
          setReplyRouted(result.routed);
          setReplyAgentName(result.agentName);
          if (result.clearMessage) {
            setMessage('');
          }
        },
        onError: setError,
        onTrace: setAuthTraceInput,
        onFinish: () => {
          setLoading(false);
        },
      },
    );
  }

  function runAuthProbe(): void {
    void postAuthProbe(authPreset, {
      onStart: () => {
        setProbing(true);
        setError(null);
      },
      onError: setError,
      onTrace: setAuthTraceInput,
      onFinish: () => {
        setProbing(false);
      },
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    sendChatRequest({ message });
  }

  function handleChatModeChange(remoteEnabled: boolean): void {
    setModeError(null);
    setUseRemoteAgent(remoteEnabled);
    void persistMode('/api/chat-mode', remoteEnabled ? 'remote' : 'local', {
      apiLabel: chatModeApiLabel,
      defaultError: 'Failed to update chat mode',
    }).catch((modeUpdateError) => {
      setModeError(
        modeUpdateError instanceof Error ? modeUpdateError.message : 'Failed to update mode',
      );
    });
  }

  function handleAgentSelect(agentId: string): void {
    remote.setSelectedAgentId(agentId);
  }

  const authProfileBlocksSend = useRemoteAgent && authPreset !== 'full';
  const remoteBusy = useRemoteAgent && (remote.policyLoading || remote.agentsLoading);
  const remoteBlocked = isRemoteSendBlocked(useRemoteAgent, remote);
  const sendDisabled =
    loading || message.trim().length === 0 || remoteBusy || remoteBlocked || authProfileBlocksSend;

  return {
    useRemoteAgent,
    remote,
    message,
    reply,
    replyAgentName,
    replyViaRemote,
    replyDemoMode,
    replyRouted,
    error,
    loading,
    modeError,
    authTraceInput,
    authPreset,
    probing,
    selectedAgentName: selectedAgent?.name ?? remote.selectedAgentId,
    showAuthProofControls,
    policyUnavailable,
    authProfileBlocksSend,
    sendDisabled,
    setMessage,
    setAuthPreset,
    onSubmit,
    handleChatModeChange,
    handleAgentSelect,
    onProofAction: (action, proofMessage) => {
      sendChatRequest({ message: proofMessage, demoAction: action });
    },
    onRunAuthProbe: runAuthProbe,
  };
}
