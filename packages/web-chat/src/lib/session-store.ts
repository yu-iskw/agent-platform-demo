import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'session_id';
const SESSION_TTL_SECONDS = 60 * 60;

export type AppSession = {
  email: string;
  googleAccessToken: string;
};

function sessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(input: AppSession): Promise<string> {
  return await new SignJWT({
    email: input.email,
    googleAccessToken: input.googleAccessToken,
  } satisfies AppSession)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(sessionSecret());
}

export async function getSession(token: string | undefined): Promise<AppSession | null> {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    const email = payload.email;
    const googleAccessToken = payload.googleAccessToken;
    if (typeof email !== 'string' || typeof googleAccessToken !== 'string') {
      return null;
    }
    return { email, googleAccessToken };
  } catch {
    return null;
  }
}

export { SESSION_TTL_SECONDS };
