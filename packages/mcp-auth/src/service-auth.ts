import { GoogleAuth } from 'google-auth-library';

import { getEmailFromGoogleAccessToken } from './google-access-token.js';
import { getOAuth2Client } from './oauth2-client.js';
import { extractBearerToken } from './session-jwt.js';

export type ServiceAuthOptions = {
  expectedServiceAccountEmail?: string;
  authMode?: string;
  audience?: string;
};

export type ServiceCallerIdentity = {
  email: string;
  isServiceAccount: boolean;
};

export function assertServiceAuthModeAllowed(authMode: string | undefined): void {
  if (authMode === 'dev' && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_MODE=dev is not allowed in production');
  }
}

export function looksLikeJwtIdToken(token: string): boolean {
  return token.startsWith('eyJ');
}

const MISSING_BEARER_TOKEN = 'Missing bearer token';

const idTokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function fetchCloudRunIdToken(audience: string): Promise<string> {
  const cached = idTokenCache.get(audience);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(audience);
  const token = await client.idTokenProvider.fetchIdToken(audience);
  idTokenCache.set(audience, { token, expiresAt: Date.now() + 50 * 60 * 1000 });
  return token;
}

export async function verifyCloudRunCaller(
  authorizationHeader: string | undefined,
  options: ServiceAuthOptions,
): Promise<string> {
  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    throw new Error(MISSING_BEARER_TOKEN);
  }

  if (!looksLikeJwtIdToken(token)) {
    throw new Error('Expected Cloud Run identity token');
  }

  const client = getOAuth2Client();
  const ticket = await client.verifyIdToken({
    idToken: token,
    ...(options.audience ? { audience: options.audience } : {}),
  });
  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase();

  if (!email) {
    throw new Error('Unexpected caller identity');
  }

  return email;
}

function isExpectedServiceAccount(
  email: string,
  expectedServiceAccountEmail: string | undefined,
): boolean {
  const expected = expectedServiceAccountEmail?.trim().toLowerCase();
  return Boolean(expected && email === expected);
}

export async function verifyMcpServiceCaller(
  authorizationHeader: string | undefined,
  options: ServiceAuthOptions,
): Promise<ServiceCallerIdentity | undefined> {
  assertServiceAuthModeAllowed(options.authMode);

  if (options.authMode === 'dev') {
    return undefined;
  }

  if (options.authMode === 'google') {
    const token = extractBearerToken(authorizationHeader);
    if (!token) {
      throw new Error(MISSING_BEARER_TOKEN);
    }

    const email = await getEmailFromGoogleAccessToken(token);
    return { email, isServiceAccount: false };
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    throw new Error(MISSING_BEARER_TOKEN);
  }

  if (looksLikeJwtIdToken(token)) {
    const email = await verifyCloudRunCaller(authorizationHeader, options);
    return {
      email,
      isServiceAccount: isExpectedServiceAccount(email, options.expectedServiceAccountEmail),
    };
  }

  const email = await getEmailFromGoogleAccessToken(token);
  return { email, isServiceAccount: false };
}
