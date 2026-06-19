const PLACEHOLDER_PATTERN = /…|\.\.\./;

export function resolveAgentUrl(raw: string | undefined): string {
  const agentUrl = raw?.trim() || 'http://127.0.0.1:8081';

  if (PLACEHOLDER_PATTERN.test(agentUrl)) {
    throw new Error(
      `AGENT_URL looks like a documentation placeholder: ${agentUrl}\n` +
        'Do not copy ellipsis URLs from docs. Resolve the real Cloud Run URL:\n' +
        "  gcloud run services describe remote-agent --format='value(status.url)'\n" +
        'Or run:\n' +
        '  ./scripts/run-cloud-check.sh\n' +
        '  ./scripts/agent-cli.sh "<message>"   # auto-resolves when AGENT_URL is unset',
    );
  }

  try {
    const parsed = new URL(agentUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('expected http or https');
    }
  } catch {
    throw new Error(
      `Invalid AGENT_URL: ${agentUrl}\n` +
        'Use a full URL (local: http://127.0.0.1:8081 or Cloud Run *.run.app).\n' +
        "  gcloud run services describe remote-agent --format='value(status.url)'",
    );
  }

  return agentUrl.replace(/\/+$/, '');
}
