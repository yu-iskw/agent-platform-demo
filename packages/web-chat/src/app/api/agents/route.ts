import { discoverAgents, runWithUserAuthorization } from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession, SESSION_COOKIE } from '@/lib/session-store';

function resolveAgentHostUrl(): string {
  return process.env.AGENT_URL ?? 'http://127.0.0.1:8081';
}

export type AgentListItem = {
  id: string;
  name: string;
  description: string;
  serviceUrl: string;
  enabled: true;
  skillTags: string[];
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
      discoverAgents(hostUrl),
    );

    const items: AgentListItem[] = agents.map((agent) => ({
      id: agent.id,
      name: agent.card.name,
      description: agent.card.description,
      serviceUrl: agent.serviceUrl,
      enabled: true as const,
      skillTags: [...new Set(agent.card.skills.flatMap((skill) => skill.tags))],
    }));

    return NextResponse.json({ agents: items });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent discovery failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
