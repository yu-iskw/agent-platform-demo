'use client';

import { AgentAvailabilityPanel } from '@/components/agent-availability-panel';
import { AgentCardPicker } from '@/components/agent-card-picker';
import { AuthProbePanel } from '@/components/auth-probe-panel';
import { AuthProofControls } from '@/components/auth-proof-controls';
import { NegativeChecksPanel } from '@/components/negative-checks-panel';
import { RemoteAgentPlatformInfo } from '@/components/remote-agent-platform-info';
import { SegmentedToggle } from '@/components/segmented-toggle';
import type { RemoteAgentData } from '@/components/use-remote-agent-data';
import type { AuthProbePreset } from '@/lib/auth-trace';
import { panelStyle } from '@/lib/ui-tokens';

import type { DemoAction } from '@agent-platform/agent-client';

type ControlPlaneProps = {
  useRemoteAgent: boolean;
  modeError: string | null;
  loading: boolean;
  remote: RemoteAgentData;
  selectedAgentName: string;
  showAuthProofControls: boolean;
  onChatModeChange: (remote: boolean) => void;
  onProofAction: (action: DemoAction, message: string) => void;
  onAgentSelect: (agentId: string) => void;
  authPreset: AuthProbePreset;
  probing: boolean;
  onAuthPresetChange: (preset: AuthProbePreset) => void;
  onRunAuthProbe: () => void;
};

export function ControlPlane({
  useRemoteAgent,
  modeError,
  loading,
  remote,
  selectedAgentName,
  showAuthProofControls,
  onChatModeChange,
  onProofAction,
  onAgentSelect,
  authPreset,
  probing,
  onAuthPresetChange,
  onRunAuthProbe,
}: ControlPlaneProps): React.JSX.Element {
  return (
    <div>
      <div style={panelStyle()}>
        <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>Chat mode</p>
        <SegmentedToggle
          ariaLabel="Chat mode"
          options={[
            { value: 'local', label: 'Local' },
            { value: 'remote', label: 'Remote A2A' },
          ]}
          value={useRemoteAgent ? 'remote' : 'local'}
          onChange={(value) => {
            onChatModeChange(value === 'remote');
          }}
        />
      </div>

      {modeError ? <p style={{ color: 'crimson', marginTop: '0.75rem' }}>{modeError}</p> : null}

      {useRemoteAgent ? (
        <>
          <AuthProbePanel
            preset={authPreset}
            probing={probing}
            onPresetChange={onAuthPresetChange}
            onRunProbe={onRunAuthProbe}
          />
          <AgentAvailabilityPanel
            agents={remote.policyAgents}
            loading={remote.policyLoading}
            error={remote.policyError}
            togglingId={remote.togglingId}
            onToggle={(agentId, enabled) => {
              void remote.toggleAgent(agentId, enabled);
            }}
          />
          {remote.policyError ? (
            <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              {remote.policyError.includes('403') ? (
                <>
                  IAM may be blocking this app. Run{' '}
                  <code>gcloud auth application-default login</code> and confirm your email is in{' '}
                  <code>allowed_emails</code> (Terraform).
                </>
              ) : (
                <>Agent policy could not be loaded: {remote.policyError}</>
              )}{' '}
              Proof actions below still run — useful to demonstrate layer failures.
            </p>
          ) : null}
          {remote.agentsLoading ? <p style={{ marginTop: '0.75rem' }}>Loading agents…</p> : null}
          {remote.agentsError && !remote.policyError ? (
            <p style={{ color: 'crimson', marginTop: '0.75rem' }}>{remote.agentsError}</p>
          ) : null}
          <AgentCardPicker
            agents={remote.selectableAgents}
            selectedAgentId={remote.selectedAgentId}
            onSelectAgent={onAgentSelect}
          />
          <p style={{ color: '#555', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            BigQuery-flavored prompts auto-route to BigQuery Assistant when enabled.
          </p>
          {showAuthProofControls ? (
            <AuthProofControls
              loading={loading}
              controlsDisabled={loading || probing || authPreset !== 'full'}
              onProofAction={onProofAction}
            />
          ) : null}
          <RemoteAgentPlatformInfo
            selectedAgentId={remote.selectedAgentId}
            agentName={selectedAgentName}
            platformInfo={remote.platformInfo}
            loading={remote.platformInfoLoading}
            error={remote.platformInfoError}
          />
        </>
      ) : (
        <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.75rem' }}>
          Local mode uses the web-chat agent only — no remote-agent or bq-mcp calls.
        </p>
      )}

      <NegativeChecksPanel />
    </div>
  );
}
