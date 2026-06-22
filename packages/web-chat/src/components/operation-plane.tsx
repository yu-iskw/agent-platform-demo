'use client';

import { AuthTraceStrip } from '@/components/auth-trace-strip';
import { buildReplyModeLabel, ChatReplyPanel } from '@/components/chat-reply-panel';
import { chatPlaceholder } from '@/components/use-remote-agent-data';
import type { AuthTraceInput } from '@/lib/auth-trace';

import type { DemoMode } from '@agent-platform/agent-client';
import type { FormEvent } from 'react';

type OperationPlaneProps = {
  useRemoteAgent: boolean;
  selectedAgentId: string;
  message: string;
  reply: string | null;
  replyAgentName: string | null;
  replyViaRemote: boolean | null;
  replyDemoMode: DemoMode | null;
  replyRouted: boolean;
  error: string | null;
  loading: boolean;
  sendDisabled: boolean;
  authProfileBlocksSend: boolean;
  policyUnavailable: boolean;
  authTraceInput: AuthTraceInput | null;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function OperationPlane({
  useRemoteAgent,
  selectedAgentId,
  message,
  reply,
  replyAgentName,
  replyViaRemote,
  replyDemoMode,
  replyRouted,
  error,
  loading,
  sendDisabled,
  authProfileBlocksSend,
  policyUnavailable,
  authTraceInput,
  onMessageChange,
  onSubmit,
}: OperationPlaneProps): React.JSX.Element {
  const replyModeLabel = buildReplyModeLabel({
    replyViaRemote,
    replyDemoMode,
    replyAgentName,
  });

  const textareaPlaceholder = policyUnavailable
    ? 'Policy unavailable — use proof actions in the control plane'
    : chatPlaceholder(selectedAgentId, useRemoteAgent);

  return (
    <div>
      <AuthTraceStrip input={authTraceInput} />

      {error ? <p style={{ color: 'crimson', marginBottom: '0.75rem' }}>{error}</p> : null}

      {reply ? (
        <ChatReplyPanel
          replyModeLabel={replyModeLabel}
          reply={reply}
          replyRouted={replyRouted}
          replyAgentName={replyAgentName}
        />
      ) : (
        <p style={{ color: '#555', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
          Operation plane — send a message or run a proof action from the control plane.
        </p>
      )}

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
      >
        <textarea
          value={message}
          onChange={(event) => {
            onMessageChange(event.target.value);
          }}
          placeholder={textareaPlaceholder}
          rows={5}
          style={{ width: '100%', padding: '0.5rem' }}
        />
        {authProfileBlocksSend ? (
          <p style={{ color: '#555', fontSize: '0.85rem', margin: 0 }}>
            Switch auth profile to Full to use Send. Proof buttons still use the selected profile.
          </p>
        ) : null}
        <button type="submit" disabled={sendDisabled}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
