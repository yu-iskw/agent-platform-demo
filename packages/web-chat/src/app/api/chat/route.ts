import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { sendMessageViaRemoteAgent } from '@/lib/a2a-client';
import { runLocalChatAgent } from '@/lib/local-chat-agent';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

type ChatRequestBody = {
  useRemoteAgent?: boolean;
  message?: string;
};

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const body = (await request.json()) as ChatRequestBody;
  const useRemoteAgent = body.useRemoteAgent ?? false;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    const reply = useRemoteAgent
      ? await sendMessageViaRemoteAgent(session, message)
      : await runLocalChatAgent(message, session.email);

    return NextResponse.json({ reply, useRemoteAgent });
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Chat request failed';
    return NextResponse.json({ error: errMessage }, { status: 502 });
  }
}
