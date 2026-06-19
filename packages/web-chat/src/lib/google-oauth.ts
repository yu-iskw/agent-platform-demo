import { createHash, randomBytes } from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/bigquery'].join(' ');

export const OAUTH_PKCE_COOKIE = 'oauth_pkce';
const PKCE_TTL_SECONDS = 10 * 60;

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export type PkceCookiePayload = {
  state: string;
  codeVerifier: string;
};

export function encodePkceCookie(payload: PkceCookiePayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodePkceCookie(value: string): PkceCookiePayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'state' in parsed &&
      'codeVerifier' in parsed &&
      typeof parsed.state === 'string' &&
      typeof parsed.codeVerifier === 'string'
    ) {
      return { state: parsed.state, codeVerifier: parsed.codeVerifier };
    }
    return null;
  } catch {
    return null;
  }
}

export function buildGoogleAuthUrl(redirectUri: string): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = base64Url(randomBytes(16));

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID is not set');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  return { url: `${GOOGLE_AUTH_URL}?${params.toString()}`, state, codeVerifier };
}

export type GoogleTokenResponse = {
  access_token: string;
  id_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
};

export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId) {
    throw new Error('GOOGLE_OAUTH_CLIENT_ID is not configured');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });
  if (clientSecret) {
    body.set('client_secret', clientSecret);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = `Google token exchange failed: ${response.status}`;
    try {
      const parsed = JSON.parse(errorBody) as { error?: string; error_description?: string };
      if (parsed.error_description) {
        detail = `${detail} — ${parsed.error_description}`;
      } else if (parsed.error) {
        detail = `${detail} — ${parsed.error}`;
      }
    } catch {
      if (errorBody) {
        detail = `${detail} — ${errorBody.slice(0, 200)}`;
      }
    }
    throw new Error(detail);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

export function getOAuthRedirectUri(requestUrl: URL): string {
  const configured = process.env.OAUTH_REDIRECT_URI;
  if (configured) {
    return configured;
  }

  return `${requestUrl.protocol}//${requestUrl.host}/api/auth/callback`;
}

export { PKCE_TTL_SECONDS };
