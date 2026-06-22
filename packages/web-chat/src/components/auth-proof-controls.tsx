'use client';

import { panelStyle } from '@/lib/ui-tokens';

import type { DemoAction } from '@agent-platform/agent-client';

const proofActions: { action: DemoAction; label: string; message: string }[] = [
  {
    action: 'get_authenticated_user',
    label: 'Prove identity',
    message: 'Prove delegated Google identity via bq-mcp',
  },
  {
    action: 'list_datasets',
    label: 'List datasets',
    message: 'List BigQuery datasets via delegated bq-mcp chain',
  },
];

type AuthProofControlsProps = {
  loading: boolean;
  controlsDisabled: boolean;
  onProofAction: (action: DemoAction, message: string) => void;
};

export function AuthProofControls({
  loading,
  controlsDisabled,
  onProofAction,
}: AuthProofControlsProps): React.JSX.Element {
  return (
    <div style={{ ...panelStyle(), marginTop: '0.75rem' }}>
      <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>Auth proof (JSON)</p>
      <p style={{ color: '#555', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
        Runs deterministic MCP proof without the LLM. Use Send for natural-language chat.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {proofActions.map((proof) => (
          <button
            key={proof.action}
            type="button"
            disabled={loading || controlsDisabled}
            onClick={() => {
              onProofAction(proof.action, proof.message);
            }}
          >
            {proof.label}
          </button>
        ))}
      </div>
    </div>
  );
}
