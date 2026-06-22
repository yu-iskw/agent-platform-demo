'use client';

import { SegmentedToggle } from '@/components/segmented-toggle';
import { panelStyle } from '@/lib/ui-tokens';

import type { DemoAction, DemoMode } from '@agent-platform/agent-client';

export const proofActions: { action: DemoAction; label: string; message: string }[] = [
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

type DirectProofControlsProps = {
  demoMode: DemoMode;
  loading: boolean;
  controlsDisabled: boolean;
  onDemoModeChange: (mode: DemoMode) => void;
  onProofAction: (action: DemoAction, message: string) => void;
};

export function DirectProofControls({
  demoMode,
  loading,
  controlsDisabled,
  onDemoModeChange,
  onProofAction,
}: DirectProofControlsProps): React.JSX.Element {
  return (
    <div style={{ ...panelStyle(), marginTop: '0.75rem' }}>
      <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>Remote path (BigQuery)</p>
      <SegmentedToggle
        ariaLabel="Remote path mode"
        options={[
          { value: 'agent', label: 'Agent via LLM' },
          { value: 'direct', label: 'Direct tool' },
        ]}
        value={demoMode}
        disabled={controlsDisabled}
        onChange={onDemoModeChange}
      />
      {demoMode === 'direct' ? (
        <>
          <p style={{ color: '#555', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
            Use proof buttons below. Free-form Send is disabled in direct mode.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
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
        </>
      ) : null}
    </div>
  );
}
