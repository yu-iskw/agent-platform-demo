import {
  fetchAgentPolicy,
  parseDemoAction,
  resolveChatAgentId,
  runWithUserAuthorization,
} from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { sendMessageViaRemoteAgent, sendProofWithAuthProfile } from '@/lib/a2a-client';
import { resolveAgentHostUrl } from '@/lib/agent-url';
import {
  AuthProfileError,
  parseAuthProbePreset,
  rejectNonFullFreeformChat,
} from '@/lib/auth-probe';
import type { AuthProbePreset } from '@/lib/auth-trace';
import { parseChatMode, useRemoteAgentFromMode, CHAT_MODE_COOKIE } from '@/lib/chat-mode';
import { parseDemoMode, DEMO_MODE_COOKIE, resolveRemoteDemoRequest } from '@/lib/demo-mode';
import { runLocalChatAgent } from '@/lib/local-chat-agent';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

type ChatRequestBody = {
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

  const body = (await request.json()) as ChatRequestBody;
  const chatMode = parseChatMode(cookieStore.get(CHAT_MODE_COOKIE)?.value);
  const useRemoteAgent = useRemoteAgentFromMode(chatMode);
  const demoMode = parseDemoMode(cookieStore.get(DEMO_MODE_COOKIE)?.value);
  const authPreset = parseAuthProbePreset(body.authPreset) ?? 'full';
  const message = body.message?.trim();
  const selectedAgentId = body.agentId?.trim() || 'bigquery';
  const demoAction = parseDemoAction(body.demoAction);

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const freeformError = rejectNonFullFreeformChat({
    useRemoteAgent,
    demoAction,
    authPreset,
  });
  if (freeformError) {
    return NextResponse.json({ error: freeformError, authPreset }, { status: 400 });
  }

  try {
    if (!useRemoteAgent) {
      const reply = await runLocalChatAgent(message, session.email);
      return NextResponse.json({ reply, useRemoteAgent: false, chatMode });
    }

    const hostUrl = resolveAgentHostUrl();

    if (demoAction && authPreset !== 'full') {
      const resolvedDemo = resolveRemoteDemoRequest({
        cookieMode: demoMode,
        useRemoteAgent: true,
        routedAgentId: selectedAgentId,
        demoAction,
        projectIdEnv: process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
      });

      if (resolvedDemo.error) {
        return NextResponse.json({ error: resolvedDemo.error, authPreset }, { status: 400 });
      }

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
          chatMode,
          demoMode: resolvedDemo.mode,
          agentId: selectedAgentId,
          routed: false,
          selectedAgentId,
        },
        authPreset,
      );
    }

    const { agentId, routed } = await runWithUserAuthorization(
      session.googleAccessToken,
      hostUrl,
      async () => {
        const policy = await fetchAgentPolicy(hostUrl);
        return resolveChatAgentId(message, selectedAgentId, policy);
      },
    );

    const resolvedDemo = resolveRemoteDemoRequest({
      cookieMode: demoMode,
      useRemoteAgent: true,
      routedAgentId: agentId,
      demoAction,
      projectIdEnv: process.env.GOOGLE_CLOUD_PROJECT?.trim() || undefined,
    });

    if (resolvedDemo.error) {
      return NextResponse.json({ error: resolvedDemo.error, authPreset }, { status: 400 });
    }

    const reply = await sendMessageViaRemoteAgent({
      session,
      message,
      agentId,
      demoMode: resolvedDemo.mode,
      demoAction: resolvedDemo.demoAction,
      demoProjectId: resolvedDemo.demoProjectId,
    });

    return jsonWithAuthPreset(
      {
        reply,
        useRemoteAgent: true,
        chatMode,
        demoMode: resolvedDemo.mode,
        agentId,
        routed,
        selectedAgentId,
      },
      authPreset,
    );
  } catch (error) {
    if (error instanceof AuthProfileError) {
      return NextResponse.json({ error: error.message, authPreset }, { status: error.httpStatus });
    }
    const errMessage = error instanceof Error ? error.message : 'Chat request failed';
    const status = errMessage.includes('not enabled or not available') ? 400 : 502;
    return NextResponse.json({ error: errMessage, authPreset }, { status });
  }
}
