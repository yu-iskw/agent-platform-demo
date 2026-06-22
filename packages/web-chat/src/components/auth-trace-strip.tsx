'use client';

import { buildAuthTrace, type AuthLayer, type AuthTraceInput } from '@/lib/auth-trace';
import { colors, panelStyle } from '@/lib/ui-tokens';

function badgeStyle(status: AuthLayer['status']): React.CSSProperties {
  switch (status) {
    case 'ok':
      return { background: colors.okBg, color: colors.okText };
    case 'fail':
      return { background: colors.failBg, color: colors.failText };
    case 'skipped':
      return { background: colors.skipBg, color: colors.skipText };
    case 'unknown':
      return { background: colors.unknownBg, color: colors.unknownText };
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

function statusLabel(status: AuthLayer['status']): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'fail':
      return 'FAIL';
    case 'skipped':
      return 'SKIP';
    case 'unknown':
      return '?';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function AuthTraceStrip({ input }: { input: AuthTraceInput | null }): React.JSX.Element {
  const layers = input ? buildAuthTrace(input) : null;

  return (
    <div style={{ ...panelStyle(), marginBottom: '0.75rem' }}>
      <p style={{ fontWeight: 600, margin: '0 0 0.5rem' }}>Auth trace (last probe or request)</p>
      {!layers ? (
        <p style={{ color: '#555', fontSize: '0.9rem', margin: 0 }}>
          Send a message to see layer status.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {layers.map((layer) => (
            <li
              key={layer.id}
              style={{
                alignItems: 'center',
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '0.35rem',
              }}
            >
              <span
                style={{
                  ...badgeStyle(layer.status),
                  borderRadius: 4,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  minWidth: '2.5rem',
                  padding: '0.1rem 0.35rem',
                  textAlign: 'center',
                }}
              >
                {statusLabel(layer.status)}
              </span>
              <span style={{ fontWeight: 500, minWidth: '7rem' }}>{layer.label}</span>
              <span style={{ color: '#555', fontSize: '0.85rem' }}>{layer.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
