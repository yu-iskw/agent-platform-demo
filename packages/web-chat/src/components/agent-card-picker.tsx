'use client';

export type AgentCardItem = {
  id: string;
  name: string;
  description: string;
  skillTags: string[];
};

const cardBase = {
  border: '1px solid #ccc',
  borderRadius: 6,
  cursor: 'pointer',
  padding: '0.75rem',
  textAlign: 'left' as const,
  width: '100%',
};

export function AgentCardPicker({
  agents,
  selectedAgentId,
  onSelectAgent,
}: {
  agents: AgentCardItem[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
}): React.JSX.Element {
  if (agents.length === 0) {
    return (
      <p style={{ color: '#555', marginTop: '0.75rem' }}>No agents enabled — turn one on above.</p>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Remote agent"
      style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}
    >
      {agents.map((agent) => {
        const selected = agent.id === selectedAgentId;
        return (
          <button
            key={agent.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              onSelectAgent(agent.id);
            }}
            style={{
              ...cardBase,
              background: selected ? '#f0f7ff' : '#fff',
              borderColor: selected ? '#1a73e8' : '#ccc',
            }}
          >
            <strong>{agent.name}</strong>
            {agent.description ? (
              <span style={{ display: 'block', color: '#555', marginTop: '0.25rem' }}>
                {agent.description}
              </span>
            ) : null}
            {agent.skillTags.length > 0 ? (
              <span
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}
              >
                {agent.skillTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: '#f4f4f4',
                      borderRadius: 4,
                      fontSize: '0.8rem',
                      padding: '0.1rem 0.4rem',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
