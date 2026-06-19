import { collectPlatformInfo, runWithUserAuthorization } from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSession, SESSION_COOKIE } from '@/lib/session-store';

function resolveAgentUrl(): string {
  return process.env.AGENT_URL ?? 'http://127.0.0.1:8081';
}

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const agentUrl = resolveAgentUrl();

  try {
    const info = await runWithUserAuthorization(session.googleAccessToken, agentUrl, async () =>
      collectPlatformInfo({
        agentUrl,
        googleAccessToken: session.googleAccessToken,
        includeBqMcp: false,
      }),
    );

    return NextResponse.json(info);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Platform info request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
