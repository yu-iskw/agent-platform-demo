import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { DEMO_MODE_COOKIE, parseDemoMode, type DemoMode } from '@/lib/demo-mode';
import { getSession, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session-store';

type DemoModeRequestBody = {
  mode?: string;
};

function parseRequestedMode(mode: string | undefined): DemoMode | null {
  if (mode === 'agent' || mode === 'direct') {
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

  const body = (await request.json()) as DemoModeRequestBody;
  const mode = parseRequestedMode(body.mode?.trim());
  if (!mode) {
    return NextResponse.json({ error: 'mode must be "agent" or "direct"' }, { status: 400 });
  }

  const response = NextResponse.json({ mode });
  response.cookies.set(DEMO_MODE_COOKIE, mode, {
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

  const mode = parseDemoMode(cookieStore.get(DEMO_MODE_COOKIE)?.value);
  return NextResponse.json({ mode });
}
