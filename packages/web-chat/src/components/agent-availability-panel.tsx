'use client';

export type AgentPolicyRow = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

const detailsStyle = {
  border: '1px solid #ddd',
  borderRadius: 4,
  marginTop: '0.75rem',
  padding: '0.5rem 0.75rem',
} as const;

const badgeBase = {
  borderRadius: 4,
  fontSize: '0.75rem',
  fontWeight: 600,
  marginLeft: '0.5rem',
  padding: '0.1rem 0.4rem',
} as const;

export function AgentAvailabilityPanel({
  agents,
  loading,
  error,
  togglingId,
  onToggle,
}: {
  agents: AgentPolicyRow[];
  loading: boolean;
  error: string | null;
  togglingId: string | null;
  onToggle: (agentId: string, enabled: boolean) => void;
}): React.JSX.Element {
  return (
    <details open style={detailsStyle}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Agent availability</summary>
      <p style={{ margin: '0.5rem 0 0', color: '#555', fontSize: '0.9rem' }}>
        Runtime demo setting — resets when remote-agent restarts.
      </p>
      {loading ? <p style={{ marginTop: '0.5rem' }}>Loading policy…</p> : null}
      {error ? <p style={{ color: 'crimson', marginTop: '0.5rem' }}>{error}</p> : null}
      {agents.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
          {agents.map((agent) => (
            <li
              key={agent.id}
              style={{
                alignItems: 'flex-start',
                borderTop: '1px solid #eee',
                display: 'flex',
                gap: '0.75rem',
                opacity: agent.enabled ? 1 : 0.65,
                padding: '0.5rem 0',
              }}
            >
              <label style={{ cursor: 'pointer', flex: 1 }}>
                <input
                  type="checkbox"
                  checked={agent.enabled}
                  disabled={togglingId === agent.id}
                  onChange={(event) => {
                    onToggle(agent.id, event.target.checked);
                  }}
                  style={{ marginRight: '0.5rem' }}
                />
                <strong>{agent.name}</strong>
                <span
                  style={{
                    ...badgeBase,
                    background: agent.enabled ? '#e6f4ea' : '#f1f1f1',
                    color: agent.enabled ? '#137333' : '#555',
                  }}
                >
                  {agent.enabled ? 'Active' : 'Unavailable'}
                </span>
                {agent.description ? (
                  <span style={{ display: 'block', color: '#555', fontSize: '0.9rem' }}>
                    {agent.description}
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
