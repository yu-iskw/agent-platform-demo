import { getHttpHeader } from './http-header.js';

import type { IncomingHttpHeaders } from 'node:http';

export const USER_ACCESS_TOKEN_HEADER = 'x-user-access-token';

export function getUserAccessTokenFromHeaders(
  headers: IncomingHttpHeaders | Record<string, string | string[] | undefined>,
): string | null {
  const token = getHttpHeader(headers, USER_ACCESS_TOKEN_HEADER);
  return token?.trim() ? token.trim() : null;
}
