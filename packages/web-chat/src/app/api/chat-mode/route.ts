import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { CHAT_MODE_COOKIE, parseChatMode, type ChatMode } from '@/lib/chat-mode';
import { getSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session-store';

type ChatModeRequestBody = {
  mode?: string;
};

function parseRequestedMode(mode: string | undefined): ChatMode | null {
  if (mode === 'local' || mode === 'remote') {
    return mode;
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const body = (await request.json()) as ChatModeRequestBody;
  const mode = parseRequestedMode(body.mode?.trim());
  if (!mode) {
    return NextResponse.json({ error: 'mode must be "local" or "remote"' }, { status: 400 });
  }

  const response = NextResponse.json({ mode });
  response.cookies.set(CHAT_MODE_COOKIE, mode, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Session expired — sign in again' }, { status: 401 });
  }

  const mode = parseChatMode(cookieStore.get(CHAT_MODE_COOKIE)?.value);
  return NextResponse.json({ mode });
}
