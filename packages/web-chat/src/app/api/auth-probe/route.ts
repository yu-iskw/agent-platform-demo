import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { resolveAgentHostUrl } from '@/lib/agent-url';
import { parseAuthProbePreset, runAuthProbe } from '@/lib/auth-probe';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

type ProbeRequestBody = {
  preset?: unknown;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as ProbeRequestBody;
  const preset = parseAuthProbePreset(body.preset);

  if (!preset) {
    return NextResponse.json(
      { error: 'preset must be full, no_iam, iam_only, or no_session' },
      { status: 400 },
    );
  }

  if (preset === 'no_session') {
    const result = await runAuthProbe({ preset, hostUrl: resolveAgentHostUrl() });
    return NextResponse.json(result);
  }

  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const result = await runAuthProbe({
    preset,
    hostUrl: resolveAgentHostUrl(),
    googleAccessToken: session.googleAccessToken,
  });

  return NextResponse.json(result);
}
