type A2aMessageLike = { parts?: readonly unknown[] };

export function extractTextFromMessage(message: A2aMessageLike | undefined): string | undefined {
  if (!message) {
    return undefined;
  }

  const part = message.parts?.at(0);
  if (!part || typeof part !== 'object') {
    return undefined;
  }

  if ('text' in part && typeof part.text === 'string') {
    return part.text;
  }

  return undefined;
}
