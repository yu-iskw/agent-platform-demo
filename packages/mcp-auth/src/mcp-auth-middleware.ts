import { getHttpHeader } from './http-header.js';

import type { ServerResponse } from 'node:http';

function isLocalHost(host: string): boolean {
  return host.startsWith('127.0.0.1') || host.startsWith('localhost') || host.startsWith('[::1]');
}

function resourceUrlFromLocalHost(host: string, proto: string): string | undefined {
  const trimmedHost = host.split(',')[0]?.trim().split('/')[0]?.trim();
  if (!trimmedHost || !isLocalHost(trimmedHost)) {
    return undefined;
  }

  const scheme = isLocalHost(trimmedHost) ? 'http' : proto;
  return `${scheme}://${trimmedHost}/mcp`;
}

export function resolvePrmResourceUrl(
  headers: Record<string, string | string[] | undefined>,
  fallbackResourceUrl: string,
): string {
  const forwardedHost = getHttpHeader(headers, 'x-forwarded-host');
  if (forwardedHost) {
    const forwardedProto =
      getHttpHeader(headers, 'x-forwarded-proto')?.split(',')[0]?.trim() ?? 'http';
    const fromForwarded = resourceUrlFromLocalHost(forwardedHost, forwardedProto);
    if (fromForwarded) {
      return fromForwarded;
    }
  }

  const hostHeader = getHttpHeader(headers, 'host');
  if (hostHeader) {
    const fromHost = resourceUrlFromLocalHost(hostHeader, 'http');
    if (fromHost) {
      return fromHost;
    }
  }

  return fallbackResourceUrl;
}

export function writeProtectedResourceMetadata(
  res: ServerResponse,
  options: {
    resource: string;
    authorizationServers: string[];
    scopesSupported: string[];
  },
): void {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.end(
    JSON.stringify({
      resource: options.resource,
      authorization_servers: options.authorizationServers,
      scopes_supported: options.scopesSupported,
    }),
  );
}
