import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  emailVerified: boolean;
};

export async function parseGoogleIdToken(
  idToken: string,
  options?: { audience?: string },
): Promise<GoogleIdTokenClaims> {
  const audience = options?.audience ?? process.env.GOOGLE_OAUTH_CLIENT_ID;
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    ...(audience ? { audience } : {}),
  });

  const sub = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email : '';
  const emailVerified = payload.email_verified === true;

  if (!sub || !email) {
    throw new Error('Invalid Google ID token');
  }

  if (!emailVerified) {
    throw new Error('Google email is not verified');
  }

  return { sub, email, emailVerified };
}
