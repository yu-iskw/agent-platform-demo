import { getHttpHeader } from './http-header.js';
import { extractBearerToken, SESSION_AUTHORIZATION_HEADER } from './session-jwt.js';
import { looksLikeJwtIdToken } from './token-heuristic.js';
import { getUserAccessTokenFromHeaders } from './user-access-token.js';

export type ResolveDelegatedUserAccessTokenOptions = {
  /** When true, ignore JWT-shaped Authorization bearer (Cloud Run identity token). */
  excludeJwtFromAuthorization?: boolean;
};

export function resolveDelegatedUserAccessToken(
  headers: Record<string, string | string[] | undefined>,
  options: ResolveDelegatedUserAccessTokenOptions = {},
): string | undefined {
  const fromUserHeader = getUserAccessTokenFromHeaders(headers);
  if (fromUserHeader) {
    return fromUserHeader;
  }

  const sessionHeader = getHttpHeader(headers, SESSION_AUTHORIZATION_HEADER);
  const sessionToken = extractBearerToken(sessionHeader);
  if (sessionToken) {
    return sessionToken;
  }

  const authorization = getHttpHeader(headers, 'authorization');
  const bearer = extractBearerToken(authorization);
  if (!bearer) {
    return undefined;
  }

  if (options.excludeJwtFromAuthorization && looksLikeJwtIdToken(bearer)) {
    return undefined;
  }

  return bearer;
}
