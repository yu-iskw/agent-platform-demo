import { describe, expect, it } from 'vitest';

import { parseSendMessageResponse } from './parse-response.js';

describe('parseSendMessageResponse', () => {
  it('returns agent text from a message result', () => {
    const reply = parseSendMessageResponse({
      jsonrpc: '2.0',
      id: 1,
      result: {
        kind: 'message',
        messageId: 'm1',
        role: 'agent',
        parts: [{ kind: 'text', text: 'hello' }],
      },
    });

    expect(reply).toBe('hello');
  });

  it('throws on JSON-RPC error', () => {
    expect(() =>
      parseSendMessageResponse({
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32000, message: 'Agent failed' },
      }),
    ).toThrow('Agent failed');
  });
});
