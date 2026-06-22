'use client';

import { panelStyle } from '@/lib/ui-tokens';

const detailsStyle = {
  ...panelStyle(),
  marginTop: '0.75rem',
} as const;

const codeStyle = {
  background: '#f4f4f4',
  display: 'block',
  fontSize: '0.8rem',
  marginTop: '0.35rem',
  overflowX: 'auto' as const,
  padding: '0.5rem',
  whiteSpace: 'pre-wrap' as const,
};

export function NegativeChecksPanel(): React.JSX.Element {
  return (
    <details style={detailsStyle}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Negative checks (terminal)</summary>
      <p style={{ color: '#555', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>
        Use <strong>Auth profile</strong> presets above for the same checks in the UI. Proof buttons
        honor the selected profile; Send requires Full. Advanced: run from a terminal to prove each
        gate. See <code>docs/auth-proof.md</code> for full playbook.
      </p>
      <ol style={{ fontSize: '0.85rem', margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>No auth</strong> — expect 403 (Cloud Run IAM)
          <code style={codeStyle}>{`AGENT_URL="https://your-agent.run.app"
curl -s -o /dev/null -w "%{http_code}\\n" "$AGENT_URL/.well-known/api-catalog"`}</code>
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          <strong>IAM only, no user OAuth</strong> — expect 401/403 (A2A layer)
          <code
            style={codeStyle}
          >{`ID_TOKEN="$(gcloud auth print-identity-token --audiences="$AGENT_URL")"
curl -s -o /dev/null -w "%{http_code}\\n" \\
  -H "Authorization: Bearer $ID_TOKEN" \\
  "$AGENT_URL/agent-policy"`}</code>
        </li>
        <li>
          <strong>Sign out + Send</strong> — expect 401 (web session). Use Sign out in the header,
          then try Send in the operation plane.
        </li>
      </ol>
    </details>
  );
}
