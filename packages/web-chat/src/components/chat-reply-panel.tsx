import type { DemoMode } from '@agent-platform/agent-client';

type ChatReplyPanelProps = {
  replyModeLabel: string;
  reply: string;
  replyRouted: boolean;
  replyAgentName: string | null;
};

export function buildReplyModeLabel(input: {
  replyViaRemote: boolean | null;
  replyDemoMode: DemoMode | null;
  replyAgentName: string | null;
}): string {
  if (input.replyViaRemote === false) {
    return 'Reply (local web-chat agent)';
  }
  if (input.replyDemoMode === 'direct') {
    return `Reply (direct bq-mcp JSON via A2A / ${input.replyAgentName ?? 'BigQuery agent'})`;
  }
  return `Reply (remote-agent / ${input.replyAgentName ?? 'A2A agent'} via A2A)`;
}

export function ChatReplyPanel({
  replyModeLabel,
  reply,
  replyRouted,
  replyAgentName,
}: ChatReplyPanelProps): React.JSX.Element {
  return (
    <div style={{ marginTop: '1rem' }}>
      <p>
        <strong>{replyModeLabel}</strong>
        {replyRouted ? (
          <span style={{ display: 'block', color: '#555', fontWeight: 400, marginTop: '0.25rem' }}>
            Routed to {replyAgentName} based on your message (card selection was a different agent).
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
  );
}
