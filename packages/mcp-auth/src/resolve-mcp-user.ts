import { resolveDelegatedUserAccessToken } from './delegated-access-token.js';
import { getDelegationTokenFromHeaders, verifyDelegationJwt } from './delegation-jwt.js';
import { getEmailFromGoogleAccessToken } from './google-access-token.js';

import type { GoogleUserContext } from './google-user-auth-middleware.js';
import type { ServiceCallerIdentity } from './service-auth-inbound.js';

export type ResolveMcpUserOptions = {
  expectedAudience: string;
};

async function resolveFromDelegationJwt(
  headers: Record<string, string | string[] | undefined>,
  options: ResolveMcpUserOptions,
): Promise<GoogleUserContext | undefined> {
  const token = getDelegationTokenFromHeaders(headers);
  if (!token) {
    return undefined;
  }

  const claims = await verifyDelegationJwt(token, { expectedAudience: options.expectedAudience });
  return {
    email: claims.email,
    credentialSource: 'delegation_jwt',
    credentialIssuer: claims.issuer,
    credentialAudience: claims.audience,
  };
}

async function resolveFromGoogleAccessToken(
  headers: Record<string, string | string[] | undefined>,
): Promise<GoogleUserContext | undefined> {
  const userToken = resolveDelegatedUserAccessToken(headers, {
    excludeJwtFromAuthorization: true,
  });
  if (!userToken) {
    return undefined;
  }

  const email = await getEmailFromGoogleAccessToken(userToken);
  return {
    email,
    googleAccessToken: userToken,
    credentialSource: 'user_oauth_access_token',
  };
}

export async function resolveMcpUserContext(
  headers: Record<string, string | string[] | undefined>,
  options: ResolveMcpUserOptions,
): Promise<GoogleUserContext | undefined> {
  const fromDelegation = await resolveFromDelegationJwt(headers, options);
  if (fromDelegation) {
    return fromDelegation;
  }

  return await resolveFromGoogleAccessToken(headers);
}

export async function resolveAuthorizedMcpUser(
  headers: Record<string, string | string[] | undefined>,
  caller: ServiceCallerIdentity | undefined,
  options: ResolveMcpUserOptions,
): Promise<GoogleUserContext | undefined> {
  const user = await resolveMcpUserContext(headers, options);
  if (!user) {
    return undefined;
  }

  if (caller && !caller.isServiceAccount && caller.email !== user.email) {
    throw new Error('Delegated user token does not match caller identity');
  }

  return user;
}
