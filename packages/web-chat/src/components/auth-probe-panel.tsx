'use client';

import { SegmentedToggle } from '@/components/segmented-toggle';
import type { AuthProbePreset } from '@/lib/auth-trace';
import { panelStyle } from '@/lib/ui-tokens';

function presetHint(preset: AuthProbePreset): string {
  switch (preset) {
    case 'full':
      return 'Full auth: proof buttons and Send use IAM + user OAuth.';
    case 'no_session':
      return 'Proof simulates no session (401). Send disabled. Use Run probe or proof buttons.';
    case 'iam_only':
      return 'Proof sends IAM only (no user OAuth). Send disabled.';
    case 'no_iam':
      return 'Proof sends no credentials. Send disabled.';
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

type AuthProbePanelProps = {
  preset: AuthProbePreset;
  probing: boolean;
  onPresetChange: (preset: AuthProbePreset) => void;
  onRunProbe: () => void;
};

export function AuthProbePanel({
  preset,
  probing,
  onPresetChange,
  onRunProbe,
}: AuthProbePanelProps): React.JSX.Element {
  return (
    <div style={{ ...panelStyle(), marginTop: '0.75rem' }}>
      <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>Auth profile</p>
      <SegmentedToggle
        ariaLabel="Auth profile"
        options={[
          { value: 'full', label: 'Full' },
          { value: 'no_iam', label: 'No IAM' },
          { value: 'iam_only', label: 'IAM only' },
          { value: 'no_session', label: 'No session' },
        ]}
        value={preset}
        disabled={probing}
        onChange={onPresetChange}
      />
      <p style={{ color: '#555', fontSize: '0.85rem', margin: '0.5rem 0' }}>{presetHint(preset)}</p>
      <button
        type="button"
        disabled={probing}
        onClick={() => {
          onRunProbe();
        }}
      >
        {probing ? 'Probing…' : 'Run probe'}
      </button>
    </div>
  );
}
