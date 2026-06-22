import { cookies } from 'next/headers';

import ChatClient from '@/components/chat-client';
import { SignOutButton } from '@/components/sign-out-button';
import { getSession, SESSION_COOKIE } from '@/lib/session-store';

export default async function HomePage(): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const session = await getSession(cookieStore.get(SESSION_COOKIE)?.value);

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        margin: '2rem auto',
        maxWidth: 'min(1100px, 100%)',
        padding: '0 1rem',
      }}
    >
      <header
        style={{
          alignItems: 'baseline',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem 1.5rem',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 0.25rem' }}>Agent platform demo console</h1>
          <p style={{ color: '#555', margin: 0, maxWidth: '42rem' }}>
            Control plane (left): modes, agents, auth proof. Operation plane (right): chat and auth
            trace.
          </p>
        </div>
        {session ? (
          <p style={{ margin: 0 }}>
            Signed in as <strong>{session.email}</strong> <SignOutButton />
          </p>
        ) : null}
      </header>

      {session ? (
        <ChatClient />
      ) : (
        <a href="/api/auth/login" style={{ display: 'inline-block', marginTop: '1rem' }}>
          Sign in with Google
        </a>
      )}
    </main>
  );
}
