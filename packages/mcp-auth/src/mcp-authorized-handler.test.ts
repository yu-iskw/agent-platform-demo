import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMcpSessionRegistry, runAuthorizedMcpRequest } from './mcp-authorized-handler.js';

import type { Request, Response } from 'express';

vi.mock('./google-access-token.js', () => ({
  getEmailFromGoogleAccessToken: vi.fn((token: string) => {
    if (token.startsWith('valid-user-token')) {
      return Promise.resolve('user@example.com');
    }
    return Promise.reject(new Error('invalid token'));
  }),
}));

function createMockResponse(): Response {
  const end = vi.fn();
  const json = vi.fn(() => ({ end }));
  const status = vi.fn(() => ({ json, end }));
  return { status, json, end } as unknown as Response;
}

function createMockRequest(input: Pick<Request, 'headers' | 'body'>): Request {
  return input as unknown as Request;
}

describe('runAuthorizedMcpRequest', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing user token before initialize creates a session', async () => {
    const onMissingUserToken = vi.fn();
    const handle = vi.fn();
    const sessionRegistry = createMcpSessionRegistry({
      createMcpServer: () => {
        throw new Error('createMcpServer should not run without a user token');
      },
    });

    await runAuthorizedMcpRequest(
      createMockRequest({
        headers: {},
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.0.0' },
          },
        },
      }),
      createMockResponse(),
      {
        sessionRegistry,
        allowInitialize: true,
        onMissingUserToken,
        onInvalidUserToken: vi.fn(),
        handle,
      },
    );

    expect(onMissingUserToken).toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it('rejects invalid session before validating user token', async () => {
    const onInvalidSession = vi.fn();
    const onMissingUserToken = vi.fn();
    const handle = vi.fn();
    const sessionRegistry = createMcpSessionRegistry({
      createMcpServer: () => {
        throw new Error('createMcpServer should not run for stale session');
      },
    });

    await runAuthorizedMcpRequest(
      createMockRequest({
        headers: { 'x-user-access-token': 'valid-user-token' },
        body: {},
      }),
      createMockResponse(),
      {
        sessionRegistry,
        allowInitialize: false,
        onMissingUserToken,
        onInvalidUserToken: vi.fn(),
        onInvalidSession,
        handle,
      },
    );

    expect(onInvalidSession).toHaveBeenCalled();
    expect(onMissingUserToken).not.toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });

  it('rejects caller email mismatch after service auth', async () => {
    const onInvalidUserToken = vi.fn();
    const handle = vi.fn();
    const sessionRegistry = createMcpSessionRegistry({
      createMcpServer: () => {
        throw new Error('createMcpServer should not run on auth failure');
      },
    });

    await runAuthorizedMcpRequest(
      createMockRequest({
        headers: {
          authorization: 'Bearer valid-user-token',
          'x-user-access-token': 'valid-user-token',
        },
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '0.0.0' },
          },
        },
      }),
      createMockResponse(),
      {
        sessionRegistry,
        allowInitialize: true,
        verifyServiceCaller: () =>
          Promise.resolve({
            email: 'other@example.com',
            isServiceAccount: false,
          }),
        onMissingUserToken: vi.fn(),
        onInvalidUserToken,
        handle,
      },
    );

    expect(onInvalidUserToken).toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });
});
