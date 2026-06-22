export function resolveAgentHostUrl(): string {
  return process.env.AGENT_URL ?? 'http://127.0.0.1:8081';
}

export function resolveAgentServiceUrl(agentId: string): string {
  return `${resolveAgentHostUrl().replace(/\/$/, '')}/agents/${agentId}`;
}
