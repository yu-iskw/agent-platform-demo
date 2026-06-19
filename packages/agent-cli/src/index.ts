#!/usr/bin/env node

import { sendAgentMessage } from '@agent-platform/agent-client';

import { getGoogleAccessTokenFromEnv } from './google-access-token.js';
import { resolveAgentUrl } from './validate-agent-url.js';

function usage(): never {
  console.error(`Usage: agent-cli <message>

Environment:
  GOOGLE_ACCESS_TOKEN  Google OAuth access token (set by scripts/agent-cli.sh)
  AGENT_URL            Agent base URL (default: http://127.0.0.1:8081; use *.run.app for Cloud Run)

Prerequisites:
  gcloud auth login
  gcloud auth application-default login
  For Cloud Run: roles/run.invoker on remote-agent (deploy scripts grant from terraform allowed_emails)

Prefer: ./scripts/agent-cli.sh "<message>"
`);
  process.exit(1);
}

async function main(): Promise<void> {
  const userMessage = process.argv
    .slice(2)
    .join(' ')
    .trim()
    .replace(/^--\s*/, '');
  if (!userMessage) {
    usage();
  }

  const agentUrl = resolveAgentUrl(process.env.AGENT_URL);
  const googleAccessToken = getGoogleAccessTokenFromEnv();

  const reply = await sendAgentMessage({
    agentUrl,
    userMessage,
    caller: { googleAccessToken },
  });

  console.log(reply);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
