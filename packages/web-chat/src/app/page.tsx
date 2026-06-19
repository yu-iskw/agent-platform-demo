import { cookies } from 'next/headers';

import ChatClient from '@/components/chat-client';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

export default async function HomePage(): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Demo: Chain of Remote A2A Agent and MCP Servers</h1>
      <p>
        Local web-chat agent is the default. Enable remote-agent to delegate over A2A and load live
        connection details from the agent.
      </p>
      {session ? (
        <ChatClient email={session.email} />
      ) : (
        <a href="/api/auth/login" style={{ display: 'inline-block', marginTop: '1rem' }}>
          Sign in with Google
        </a>
      )}
    </main>
  );
}
