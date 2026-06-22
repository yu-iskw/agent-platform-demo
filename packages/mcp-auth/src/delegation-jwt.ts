import { SignJWT, jwtVerify } from 'jose';

import { getHttpHeader } from './http-header.js';
import { extractBearerToken } from './session-jwt.js';

export const DELEGATION_TOKEN_HEADER = 'x-delegation-token';
export const DELEGATION_JWT_ISSUER = 'remote-agent';
const DELEGATION_JWT_TTL_SECONDS = 5 * 60;

export type DelegationJwtClaims = {
  email: string;
  audience: string;
  issuer: string;
};

let cachedDelegationJwtSecret: Uint8Array | undefined;
let cachedDelegationJwtSecretValue: string | undefined;

function delegationJwtSecret(): Uint8Array {
  const secret = process.env.DELEGATION_JWT_SECRET?.trim();
  if (!secret) {
    cachedDelegationJwtSecret = undefined;
    cachedDelegationJwtSecretValue = undefined;
    throw new Error('DELEGATION_JWT_SECRET is not configured');
  }
  if (cachedDelegationJwtSecret && cachedDelegationJwtSecretValue === secret) {
    return cachedDelegationJwtSecret;
  }
  cachedDelegationJwtSecretValue = secret;
  cachedDelegationJwtSecret = new TextEncoder().encode(secret);
  return cachedDelegationJwtSecret;
}

export function isDelegationJwtConfigured(): boolean {
  return Boolean(process.env.DELEGATION_JWT_SECRET?.trim());
}

export function getDelegationTokenFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const header = getHttpHeader(headers, DELEGATION_TOKEN_HEADER);
  const token = extractBearerToken(header);
  return token ?? undefined;
}

export async function mintDelegationJwt(input: {
  email: string;
  audience: string;
}): Promise<string> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const audience = new URL(input.audience).origin;

  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(normalizedEmail)
    .setIssuer(DELEGATION_JWT_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${DELEGATION_JWT_TTL_SECONDS}s`)
    .sign(delegationJwtSecret());
}

export async function verifyDelegationJwt(
  token: string,
  options: { expectedAudience: string },
): Promise<DelegationJwtClaims> {
  const expectedAudience = new URL(options.expectedAudience).origin;
  const { payload } = await jwtVerify(token, delegationJwtSecret(), {
    issuer: DELEGATION_JWT_ISSUER,
    audience: expectedAudience,
  });

  const email = typeof payload.sub === 'string' ? payload.sub.trim().toLowerCase() : '';
  if (!email) {
    throw new Error('Delegation JWT missing subject email');
  }

  const audience = Array.isArray(payload.aud)
    ? payload.aud.find((value) => typeof value === 'string')
    : payload.aud;
  if (typeof audience !== 'string') {
    throw new Error('Delegation JWT missing audience');
  }

  return {
    email,
    audience: new URL(audience).origin,
    issuer: DELEGATION_JWT_ISSUER,
  };
}
