import { parseDemoAction } from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { sendProofWithAuthProfile } from '@/lib/a2a-client';
import { AuthProfileError, parseAuthProbePreset } from '@/lib/auth-probe';
import type { AuthProbePreset } from '@/lib/auth-trace';
import { isDelegationExchangeAvailable } from '@/lib/delegation-exchange';
import { resolveRemoteDemoRequest } from '@/lib/demo-mode';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

type ChatProofRequestBody = {
  message?: string;
  agentId?: string;
  demoAction?: string;
  authPreset?: unknown;
};

function jsonWithAuthPreset(
  payload: Record<string, unknown>,
  authPreset: AuthProbePreset,
): NextResponse {
  return NextResponse.json({ ...payload, authPreset });
}

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const body = (await request.json()) as ChatProofRequestBody;
  const authPreset = parseAuthProbePreset(body.authPreset) ?? 'full';
  const message = body.message?.trim();
  const selectedAgentId = body.agentId?.trim() || 'bigquery';
  const demoAction = parseDemoAction(body.demoAction);

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (!demoAction) {
    return NextResponse.json(
      { error: 'demoAction is required for proof requests' },
      { status: 400 },
    );
  }

  const resolvedDemo = resolveRemoteDemoRequest({
    cookieMode: 'direct',
    useRemoteAgent: true,
    routedAgentId: selectedAgentId,
    demoAction,
    projectIdEnv: process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
  });

  if (resolvedDemo.error) {
    return NextResponse.json({ error: resolvedDemo.error, authPreset }, { status: 400 });
  }

  try {
    const reply = await sendProofWithAuthProfile({
      authPreset,
      session,
      message,
      agentId: selectedAgentId,
      demoMode: resolvedDemo.mode,
      demoAction: resolvedDemo.demoAction,
      demoProjectId: resolvedDemo.demoProjectId,
    });

    return jsonWithAuthPreset(
      {
        reply,
        useRemoteAgent: true,
        demoMode: resolvedDemo.mode,
        agentId: selectedAgentId,
        routed: false,
        selectedAgentId,
        delegationExchangeAvailable: isDelegationExchangeAvailable(),
      },
      authPreset,
    );
  } catch (error) {
    if (error instanceof AuthProfileError) {
      return NextResponse.json({ error: error.message, authPreset }, { status: error.httpStatus });
    }
    const errMessage = error instanceof Error ? error.message : 'Proof request failed';
    return NextResponse.json({ error: errMessage, authPreset }, { status: 502 });
  }
}
