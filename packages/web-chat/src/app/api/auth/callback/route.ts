import { parseGoogleIdToken } from '@agent-platform/mcp-auth';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { DEMO_MODE_COOKIE } from '@/lib/demo-mode';
import {
  decodePkceCookie,
  exchangeGoogleCode,
  getOAuthRedirectUri,
  OAUTH_PKCE_COOKIE,
} from '@/lib/google-oauth';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/session-store';

function authErrorRedirect(url: URL, reason: string, detail?: string): NextResponse {
  if (process.env.NODE_ENV === 'development' && detail) {
    console.error(`[auth/callback] ${reason}: ${detail}`);
  }
  const params = new URLSearchParams({ error: reason });
  return NextResponse.redirect(new URL(`/?${params.toString()}`, url));
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, url));
  }

  if (!code || !state) {
    return authErrorRedirect(url, 'missing_code');
  }

  const cookieStore = await cookies();
  const pkceRaw = cookieStore.get(OAUTH_PKCE_COOKIE)?.value;
  const pkce = pkceRaw ? decodePkceCookie(pkceRaw) : null;

  if (!pkce || pkce.state !== state) {
    return authErrorRedirect(url, 'auth_failed', 'Invalid or expired OAuth PKCE state');
  }

  try {
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID) {
      throw new Error('GOOGLE_OAUTH_CLIENT_ID is required');
    }

    const redirectUri = getOAuthRedirectUri(url);
    const tokens = await exchangeGoogleCode(code, pkce.codeVerifier, redirectUri);
    const idClaims = await parseGoogleIdToken(tokens.id_token);

    const sessionToken = await createSessionToken({
      email: idClaims.email,
      googleAccessToken: tokens.access_token,
    });

    const response = NextResponse.redirect(new URL('/', url));
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    response.cookies.delete(OAUTH_PKCE_COOKIE);
    return response;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return authErrorRedirect(url, 'auth_failed', detail);
  }
}

export function DELETE(): NextResponse {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(DEMO_MODE_COOKIE);
  return response;
}
