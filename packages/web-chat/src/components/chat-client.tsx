'use client';

import { useEffect, useState } from 'react';

import {
  a2aSummaryLines,
  bqMcpChainMetadata,
  bqMcpChainSummaryLines,
  mcpSummaryLines,
  type McpToolMetadata,
  type PlatformInfo,
} from '@/lib/platform-info';
import { readJsonResponse } from '@/lib/read-json-response';

import type { FormEvent } from 'react';

type Props = {
  email: string;
};

type ChatResponse = {
  reply?: string;
  useRemoteAgent?: boolean;
  error?: string;
};

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
              {tool.title && tool.title !== tool.name ? (
                <div style={{ fontSize: '0.85rem', color: '#555' }}>{tool.title}</div>
              ) : null}
            </td>
            <td style={{ padding: cellPadding, verticalAlign: 'top' }}>
              {tool.description ?? '—'}
              {tool.inputSchema ? (
                <pre
                  style={{
                    marginTop: '0.25rem',
                    fontSize: '0.75rem',
                    background: '#f8f8f8',
                    padding: '0.25rem',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
              ) : null}
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

export default function ChatClient({ email }: Props): React.JSX.Element {
  const [useRemoteAgent, setUseRemoteAgent] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [platformInfoLoading, setPlatformInfoLoading] = useState(false);
  const [platformInfoError, setPlatformInfoError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [replyViaRemote, setReplyViaRemote] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!useRemoteAgent) {
      setPlatformInfo(null);
      setPlatformInfoError(null);
      setPlatformInfoLoading(false);
      return;
    }

    const controller = new AbortController();
    setPlatformInfoLoading(true);
    setPlatformInfoError(null);
    setPlatformInfo(null);

    void (async (): Promise<void> => {
      try {
        const response = await fetch('/api/platform-info', { signal: controller.signal });
        const data = await readJsonResponse<PlatformInfo & { error?: string }>(
          response,
          'Platform info API',
        );
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to load platform info');
        }
        setPlatformInfo(data);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return;
        }
        setPlatformInfoError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load platform info',
        );
      } finally {
        if (!controller.signal.aborted) {
          setPlatformInfoLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [useRemoteAgent]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setReply(null);
    setReplyViaRemote(null);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useRemoteAgent, message }),
      });
      const data = await readJsonResponse<ChatResponse>(response, 'Chat API');
      if (!response.ok) {
        throw new Error(data.error ?? 'Request failed');
      }

      setReply(data.reply ?? '');
      setReplyViaRemote(data.useRemoteAgent ?? useRemoteAgent);
      setMessage('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const replyModeLabel =
    replyViaRemote === false ? 'Reply (local web-chat agent)' : 'Reply (remote-agent via A2A)';

  return (
    <section>
      <p>
        Signed in as <strong>{email}</strong>
      </p>

      <fieldset
        style={{
          border: borderLight,
          borderRadius: 4,
          marginTop: '1rem',
          padding: '0.75rem',
        }}
      >
        <legend>Remote-agent (A2A)</legend>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            name="remote-agent"
            checked={useRemoteAgent}
            onChange={() => {
              setUseRemoteAgent(true);
            }}
          />{' '}
          Use remote-agent via A2A
        </label>
        <label>
          <input
            type="radio"
            name="remote-agent"
            checked={!useRemoteAgent}
            onChange={() => {
              setUseRemoteAgent(false);
            }}
          />{' '}
          Local web-chat agent only
        </label>
      </fieldset>

      {useRemoteAgent ? (
        <>
          {platformInfoLoading ? (
            <p style={{ marginTop: '0.75rem' }}>Loading platform info…</p>
          ) : null}
          {platformInfoError ? (
            <p style={{ color: 'crimson', marginTop: '0.75rem' }}>{platformInfoError}</p>
          ) : null}
          {platformInfo ? (
            <>
              <InfoPanel title="Remote-agent via A2A" lines={a2aSummaryLines(platformInfo)} />
              <McpDetailsPanel
                title="MCP on remote-agent"
                label="Agent MCP"
                server={platformInfo.agentMcp}
              />
              <McpDetailsPanel
                title="bq-mcp (via remote-agent chain)"
                label="bq-mcp"
                server={bqMcpChainMetadata}
                summaryLines={bqMcpChainSummaryLines()}
              />
            </>
          ) : null}
        </>
      ) : null}

      <form
        onSubmit={(event) => {
          void onSubmit(event);
        }}
        style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}
      >
        <textarea
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
          }}
          placeholder={
            useRemoteAgent
              ? 'List datasets in ubie-yu-sandbox'
              : 'Ask the local web-chat agent (no remote-agent A2A)'
          }
          rows={4}
          style={{ width: '100%', padding: '0.5rem' }}
        />
        <button type="submit" disabled={loading || message.trim().length === 0}>
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>

      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
      {reply ? (
        <div style={{ marginTop: '1rem' }}>
          <p>
            <strong>{replyModeLabel}</strong>
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
      ) : null}
    </section>
  );
}
