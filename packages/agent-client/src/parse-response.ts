import { extractTextFromMessage } from '@agent-platform/mcp-auth';

import type { SendMessageResponse } from '@a2a-js/sdk';

export function parseSendMessageResponse(response: SendMessageResponse): string {
  if ('error' in response) {
    throw new Error(response.error.message);
  }

  const { result } = response;
  if (result.kind === 'message') {
    const text = extractTextFromMessage(result);
    if (text) {
      return text;
    }
  }

  if (result.kind === 'task') {
    const statusText = extractTextFromMessage(result.status.message);
    if (statusText) {
      if (result.status.state === 'failed') {
        throw new Error(statusText);
      }
      return statusText;
    }

    const lastAgentMessage = [...(result.history ?? [])]
      .reverse()
      .find((entry) => entry.role === 'agent');
    const historyText = extractTextFromMessage(lastAgentMessage);
    if (historyText) {
      return historyText;
    }
  }

  return JSON.stringify(result);
}
