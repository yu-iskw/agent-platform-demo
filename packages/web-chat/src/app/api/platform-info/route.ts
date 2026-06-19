import {
  collectPlatformInfo,
  fetchAgentPolicy,
  runWithUserAuthorization,
  validateAgentId,
} from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { resolveAgentHostUrl } from '@/lib/agent-url';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

export async function GET(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const rawAgentId = new URL(request.url).searchParams.get('agentId')?.trim() || 'bigquery';
  let agentId: string;
  try {
    agentId = validateAgentId(rawAgentId);
  } catch {
    return NextResponse.json({ error: 'Invalid agent id' }, { status: 400 });
  }
  const agentUrl = resolveAgentHostUrl();

  try {
    const info = await runWithUserAuthorization(session.googleAccessToken, agentUrl, async () => {
      const policy = await fetchAgentPolicy(agentUrl);
      const agentPolicy = policy.find((agent) => agent.id === agentId);
      if (agentPolicy && !agentPolicy.enabled) {
        throw new Error(`Agent "${agentId}" is disabled`);
      }

      return collectPlatformInfo({
        agentUrl,
        agentId,
        googleAccessToken: session.googleAccessToken,
        includeBqMcp: false,
      });
    });

    return NextResponse.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Platform info request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
