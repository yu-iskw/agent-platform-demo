import { NextResponse } from 'next/server';

import {
  buildGoogleAuthUrl,
  encodePkceCookie,
  getOAuthRedirectUri,
  OAUTH_PKCE_COOKIE,
  PKCE_TTL_SECONDS,
} from '@/lib/google-oauth';

export function GET(request: Request): NextResponse {
  const url = new URL(request.url);
  const redirectUri = getOAuthRedirectUri(url);
  const { url: authUrl, state, codeVerifier } = buildGoogleAuthUrl(redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_PKCE_COOKIE, encodePkceCookie({ state, codeVerifier }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: PKCE_TTL_SECONDS,
  });
  return response;
}
