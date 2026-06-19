'use client';

import {
  a2aSummaryLines,
  bqMcpChainMetadata,
  bqMcpChainSummaryLines,
  mcpSummaryLines,
  type McpToolMetadata,
  type PlatformInfo,
} from '@/lib/platform-info';

const detailsStyle = {
  border: '1px solid #ddd',
  borderRadius: 4,
  marginTop: '0.75rem',
  padding: '0.5rem 0.75rem',
} as const;

const listStyle = { margin: '0.5rem 0 0', paddingLeft: '1.25rem' } as const;
const borderLight = '1px solid #ccc';
const cellPadding = '0.25rem';
const resourcePrefix = 'Resource: ';
const endpointPrefix = 'Endpoint: ';

function InfoPanel({ title, lines }: { title: string; lines: string[] }): React.JSX.Element {
  return (
    <details open style={detailsStyle}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{title}</summary>
      <ul style={listStyle}>
        {lines.map((line) => (
          <li key={line} style={{ marginBottom: '0.25rem', whiteSpace: 'pre-wrap' }}>
            {line.startsWith(endpointPrefix) || line.startsWith(resourcePrefix) ? (
              <>
                {line.split(': ')[0]}: <code>{line.slice(line.indexOf(': ') + 2)}</code>
              </>
            ) : (
              line
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ToolsTable({ tools }: { tools: McpToolMetadata[] }): React.JSX.Element | null {
  if (tools.length === 0) {
    return null;
  }

  return (
    <table
      style={{
        width: '100%',
        marginTop: '0.5rem',
        borderCollapse: 'collapse',
        fontSize: '0.9rem',
      }}
    >
      <thead>
        <tr>
          <th style={{ textAlign: 'left', borderBottom: borderLight, padding: cellPadding }}>
            Tool
          </th>
          <th style={{ textAlign: 'left', borderBottom: borderLight, padding: cellPadding }}>
            Description
          </th>
        </tr>
      </thead>
      <tbody>
        {tools.map((tool) => (
          <tr key={tool.name}>
            <td style={{ padding: cellPadding, verticalAlign: 'top' }}>
              <code>{tool.name}</code>
            </td>
            <td style={{ padding: cellPadding, verticalAlign: 'top' }}>
              {tool.description ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function McpDetailsPanel({
  title,
  label,
  server,
  summaryLines,
}: {
  title: string;
  label: string;
  server: PlatformInfo['agentMcp'];
  summaryLines?: string[];
}): React.JSX.Element {
  const lines = summaryLines ?? mcpSummaryLines(label, server);
  return (
    <details open style={detailsStyle}>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{title}</summary>
      <ul style={listStyle}>
        {lines.map((line, index) => (
          <li key={`${label}-${index}`} style={{ marginBottom: '0.25rem' }}>
            {line.startsWith(resourcePrefix) ? (
              <>
                Resource: <code>{line.slice(resourcePrefix.length)}</code>
              </>
            ) : (
              line
            )}
          </li>
        ))}
      </ul>
      <ToolsTable tools={server.tools} />
    </details>
  );
}

export function RemoteAgentPlatformInfo({
  selectedAgentId,
  agentName,
  platformInfo,
  loading,
  error,
}: {
  selectedAgentId: string;
  agentName: string;
  platformInfo: PlatformInfo | null;
  loading: boolean;
  error: string | null;
}): React.JSX.Element {
  const showBqChain = selectedAgentId === 'bigquery';

  return (
    <>
      {loading ? <p style={{ marginTop: '0.75rem' }}>Loading platform info…</p> : null}
      {error ? <p style={{ color: 'crimson', marginTop: '0.75rem' }}>{error}</p> : null}
      {platformInfo ? (
        <>
          <InfoPanel
            title={`Remote-agent via A2A — ${agentName}`}
            lines={a2aSummaryLines(platformInfo)}
          />
          <McpDetailsPanel
            title="MCP on remote-agent"
            label="Agent MCP"
            server={platformInfo.agentMcp}
          />
          {showBqChain ? (
            <McpDetailsPanel
              title="bq-mcp (via remote-agent chain)"
              label="bq-mcp"
              server={bqMcpChainMetadata}
              summaryLines={bqMcpChainSummaryLines()}
            />
          ) : (
            <p style={{ color: '#555', fontSize: '0.9rem', marginTop: '0.75rem' }}>
              BigQuery MCP chain applies only to the BigQuery agent.
            </p>
          )}
        </>
      ) : null}
    </>
  );
}
