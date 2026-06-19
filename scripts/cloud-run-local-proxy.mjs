#!/usr/bin/env node
/**
 * Local HTTP proxy for private Cloud Run services.
 *
 * gcloud run services proxy overwrites Host to the service URL (required by Cloud Run).
 * MCP OAuth PRM must advertise the localhost URL the IDE uses, so this proxy sets
 * X-Forwarded-Host / X-Forwarded-Proto for resolvePrmResourceUrl() on the server.
 */
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

function readOptionValue(arg, key, argv, index) {
  if (arg === key) {
    return { value: argv[index + 1] ?? '', nextIndex: index + 1 };
  }
  const prefix = `${key}=`;
  if (arg.startsWith(prefix)) {
    return { value: arg.slice(prefix.length), nextIndex: index };
  }
  return undefined;
}

function parseArgs(argv) {
  const options = {
    target: '',
    port: 8080,
    bind: '127.0.0.1',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const target = readOptionValue(arg, '--target', argv, index);
    if (target) {
      options.target = target.value;
      index = target.nextIndex;
      continue;
    }
    const port = readOptionValue(arg, '--port', argv, index);
    if (port) {
      options.port = Number(port.value);
      index = port.nextIndex;
      continue;
    }
    const bind = readOptionValue(arg, '--bind', argv, index);
    if (bind) {
      options.bind = bind.value;
      index = bind.nextIndex;
    }
  }

  if (!options.target) {
    console.error(
      'Usage: cloud-run-local-proxy.mjs --target=https://service.run.app [--port=8080] [--bind=127.0.0.1]',
    );
    process.exit(1);
  }

  return options;
}

let cachedToken = '';
let cachedTokenAudience = '';
let cachedTokenExpiresAt = 0;

function getIdentityToken(audience) {
  const now = Date.now();
  if (cachedToken && cachedTokenAudience === audience && now < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const result = spawnSync('gcloud', ['auth', 'print-identity-token', `--audiences=${audience}`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || 'gcloud auth print-identity-token failed');
  }

  cachedToken = result.stdout.trim();
  cachedTokenAudience = audience;
  cachedTokenExpiresAt = now + 50 * 60 * 1000;
  return cachedToken;
}

function copyRequestHeaders(incomingHeaders, targetHost, clientHost, token) {
  const headers = { ...incomingHeaders };
  delete headers.host;
  delete headers.connection;
  headers.host = targetHost;
  headers['x-forwarded-host'] = clientHost;
  headers['x-forwarded-proto'] = 'http';

  // Cloud Run IAM uses Authorization; preserve IDE user OAuth in a delegated header.
  const hasDelegatedUserToken =
    headers['x-session-authorization'] || headers['x-user-access-token'];
  if (headers.authorization && !hasDelegatedUserToken) {
    headers['x-session-authorization'] = headers.authorization;
  }

  headers.authorization = `Bearer ${token}`;
  return headers;
}

function main() {
  const { target, port, bind } = parseArgs(process.argv.slice(2));
  const targetUrl = new URL(target);
  const clientHost = `${bind}:${port}`;
  const transport = targetUrl.protocol === 'https:' ? https : http;

  const server = http.createServer((req, res) => {
    let token;
    try {
      token = getIdentityToken(target);
    } catch {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad gateway');
      return;
    }

    const upstreamPath = req.url ?? '/';
    const headers = copyRequestHeaders(req.headers, targetUrl.host, clientHost, token);

    const upstream = transport.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        method: req.method,
        path: upstreamPath,
        headers,
      },
      (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
        upstreamRes.pipe(res);
      },
    );

    upstream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
      }
      res.end('[proxy error] Bad gateway');
    });

    req.pipe(upstream);
  });

  server.listen(port, bind, () => {
    console.log(`[a2a-mcp-demo] Proxying ${target} to http://${clientHost}`);
  });
}

main();
