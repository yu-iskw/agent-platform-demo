import {
  fetchAgentPolicy,
  runWithUserAuthorization,
  updateAgentPolicy,
  type AgentPolicyItem,
} from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { resolveAgentHostUrl } from '@/lib/agent-url';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

export type AgentPolicyListResponse = {
  agents: AgentPolicyItem[];
};

type PatchBody = {
  agentId?: string;
  enabled?: boolean;
};

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const hostUrl = resolveAgentHostUrl();

  try {
    const agents = await runWithUserAuthorization(session.googleAccessToken, hostUrl, async () =>
      fetchAgentPolicy(hostUrl),
    );
    return NextResponse.json({ agents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent policy fetch failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const body = (await request.json()) as PatchBody;
  const agentId = body.agentId?.trim();
  const { enabled } = body;

  if (!agentId || typeof enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'agentId and enabled (boolean) are required' },
      { status: 400 },
    );
  }

  const hostUrl = resolveAgentHostUrl();

  try {
    const agents = await runWithUserAuthorization(session.googleAccessToken, hostUrl, async () =>
      updateAgentPolicy(hostUrl, { agentId, enabled }),
    );
    return NextResponse.json({ agents });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent policy update failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
