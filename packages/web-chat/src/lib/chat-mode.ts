export const CHAT_MODE_COOKIE = 'chat_mode';

export type ChatMode = 'local' | 'remote';

export function parseChatMode(value: string | undefined): ChatMode {
  return value === 'remote' ? 'remote' : 'local';
}

export function useRemoteAgentFromMode(mode: ChatMode): boolean {
  return mode === 'remote';
}
