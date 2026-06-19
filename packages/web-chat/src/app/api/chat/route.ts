import {
  fetchAgentPolicy,
  resolveChatAgentId,
  runWithUserAuthorization,
} from '@agent-platform/agent-client';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { sendMessageViaRemoteAgent } from '@/lib/a2a-client';
import { resolveAgentHostUrl } from '@/lib/agent-url';
import { parseChatMode, useRemoteAgentFromMode, CHAT_MODE_COOKIE } from '@/lib/chat-mode';
import { runLocalChatAgent } from '@/lib/local-chat-agent';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

type ChatRequestBody = {
  message?: string;
  agentId?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const body = (await request.json()) as ChatRequestBody;
  const chatMode = parseChatMode(cookieStore.get(CHAT_MODE_COOKIE)?.value);
  const useRemoteAgent = useRemoteAgentFromMode(chatMode);
  const message = body.message?.trim();
  const selectedAgentId = body.agentId?.trim() || 'bigquery';

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    if (!useRemoteAgent) {
      const reply = await runLocalChatAgent(message, session.email);
      return NextResponse.json({ reply, useRemoteAgent: false, chatMode });
    }

    const hostUrl = resolveAgentHostUrl();
    const { agentId, routed } = await runWithUserAuthorization(
      session.googleAccessToken,
      hostUrl,
      async () => {
        const policy = await fetchAgentPolicy(hostUrl);
        return resolveChatAgentId(message, selectedAgentId, policy);
      },
    );

    const reply = await sendMessageViaRemoteAgent(session, message, agentId);
    return NextResponse.json({
      reply,
      useRemoteAgent: true,
      chatMode,
      agentId,
      routed,
      selectedAgentId,
    });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Chat request failed';
    const status = errMessage.includes('not enabled or not available') ? 400 : 502;
    return NextResponse.json({ error: errMessage }, { status });
  }
}
