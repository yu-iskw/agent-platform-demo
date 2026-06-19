'use client';

import { useEffect, useState } from 'react';

import { AgentAvailabilityPanel } from '@/components/agent-availability-panel';
import { AgentCardPicker } from '@/components/agent-card-picker';
import { RemoteAgentPlatformInfo } from '@/components/remote-agent-platform-info';
import { chatPlaceholder, useRemoteAgentData } from '@/components/use-remote-agent-data';
import { readJsonResponse } from '@/lib/read-json-response';

import type { FormEvent } from 'react';

type Props = {
  email: string;
};

type ChatResponse = {
  reply?: string;
  useRemoteAgent?: boolean;
  agentId?: string;
  routed?: boolean;
  selectedAgentId?: string;
  error?: string;
};

const borderLight = '1px solid #ccc';
const chatModeApiLabel = 'Chat mode API';
const chatModeUpdateError = 'Failed to update chat mode';

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

async function persistChatMode(mode: 'local' | 'remote'): Promise<void> {
  const response = await fetch('/api/chat-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response, chatModeApiLabel);
    throw new Error(data.error ?? chatModeUpdateError);
  }
}

export default function ChatClient({ email }: Props): React.JSX.Element {
  const [useRemoteAgent, setUseRemoteAgent] = useState(false);
  const remote = useRemoteAgentData(useRemoteAgent);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [replyAgentName, setReplyAgentName] = useState<string | null>(null);
  const [replyViaRemote, setReplyViaRemote] = useState<boolean | null>(null);
  const [replyRouted, setReplyRouted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/chat-mode');
        if (!response.ok) {
          return;
        }
        const data = await readJsonResponse<{ mode?: 'local' | 'remote' }>(
          response,
          chatModeApiLabel,
        );
        setUseRemoteAgent(data.mode === 'remote');
      } catch {
        // Keep default local mode when session cookie is unavailable.
      }
    })();
  }, []);

  const selectedAgent =
    remote.agents.find((agent) => agent.id === remote.selectedAgentId) ??
    remote.policyAgents.find((agent) => agent.id === remote.selectedAgentId);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setReply(null);
    setReplyAgentName(null);
    setReplyViaRemote(null);
    setReplyRouted(false);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          agentId: remote.selectedAgentId,
        }),
      });
      const data = await readJsonResponse<ChatResponse>(response, 'Chat API');
      if (!response.ok) {
        throw new Error(data.error ?? 'Request failed');
      }

      setReply(data.reply ?? '');
      setReplyViaRemote(data.useRemoteAgent ?? useRemoteAgent);
      setReplyRouted(Boolean(data.routed));
      if (data.useRemoteAgent ?? useRemoteAgent) {
        const replyAgent =
          remote.agents.find((agent) => agent.id === data.agentId) ??
          remote.policyAgents.find((agent) => agent.id === data.agentId);
        setReplyAgentName(replyAgent?.name ?? data.agentId ?? remote.selectedAgentId);
      }
      setMessage('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const remoteBusy = useRemoteAgent && (remote.policyLoading || remote.agentsLoading);
  const sendDisabled =
    loading ||
    message.trim().length === 0 ||
    remoteBusy ||
    isRemoteSendBlocked(useRemoteAgent, remote);

  const replyModeLabel =
    replyViaRemote === false
      ? 'Reply (local web-chat agent)'
      : `Reply (remote-agent / ${replyAgentName ?? 'A2A agent'} via A2A)`;

  return (
    <section>
      <p>
        Signed in as <strong>{email}</strong>
      </p>

      <fieldset
        style={{
          border: borderLight,
          borderRadius: 4,
          marginTop: '1rem',
          padding: '0.75rem',
        }}
      >
        <legend>Remote-agent (A2A)</legend>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            name="remote-agent"
            checked={useRemoteAgent}
            onChange={() => {
              setModeError(null);
              setUseRemoteAgent(true);
              void persistChatMode('remote').catch((modeUpdateError) => {
                setModeError(
                  modeUpdateError instanceof Error ? modeUpdateError.message : chatModeUpdateError,
                );
              });
            }}
          />{' '}
          Use remote-agent via A2A
        </label>
        <label>
          <input
            type="radio"
            name="remote-agent"
            checked={!useRemoteAgent}
            onChange={() => {
              setModeError(null);
              setUseRemoteAgent(false);
              void persistChatMode('local').catch((modeUpdateError) => {
                setModeError(
                  modeUpdateError instanceof Error ? modeUpdateError.message : chatModeUpdateError,
                );
              });
            }}
          />{' '}
          Local web-chat agent only
        </label>
      </fieldset>

      {modeError ? <p style={{ color: 'crimson', marginTop: '0.75rem' }}>{modeError}</p> : null}

      {useRemoteAgent ? (
        <>
          <AgentAvailabilityPanel
            agents={remote.policyAgents}
            loading={remote.policyLoading}
            error={remote.policyError}
            togglingId={remote.togglingId}
            onToggle={(agentId, enabled) => {
              void remote.toggleAgent(agentId, enabled);
            }}
          />
          {remote.agentsLoading ? <p style={{ marginTop: '0.75rem' }}>Loading agents…</p> : null}
          {remote.agentsError && !remote.policyError ? (
            <p style={{ color: 'crimson', marginTop: '0.75rem' }}>{remote.agentsError}</p>
          ) : null}
          <AgentCardPicker
            agents={remote.selectableAgents}
            selectedAgentId={remote.selectedAgentId}
            onSelectAgent={remote.setSelectedAgentId}
          />
          <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Default agent for general chat. BigQuery dataset questions automatically use the
            BigQuery Assistant when it is enabled.
          </p>
          <RemoteAgentPlatformInfo
            selectedAgentId={remote.selectedAgentId}
            agentName={selectedAgent?.name ?? remote.selectedAgentId}
            platformInfo={remote.platformInfo}
            loading={remote.platformInfoLoading}
            error={remote.platformInfoError}
          />
        </>
      ) : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
      >
        <textarea
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
          placeholder={chatPlaceholder(remote.selectedAgentId, useRemoteAgent)}
          rows={4}
          style={{ width: '100%', padding: '0.5rem' }}
        />
        <button type="submit" disabled={sendDisabled}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {reply ? (
        <div style={{ marginTop: '1rem' }}>
          <p>
            <strong>{replyModeLabel}</strong>
            {replyRouted ? (
              <span
                style={{ display: 'block', color: '#555', fontWeight: 400, marginTop: '0.25rem' }}
              >
                Routed to {replyAgentName} based on your message (card selection was a different
                agent).
              </span>
            ) : null}
          </p>
          <pre
            style={{
              background: '#f4f4f4',
              padding: '1rem',
              whiteSpace: 'pre-wrap',
            }}
          >
            {reply}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
