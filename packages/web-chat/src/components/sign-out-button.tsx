'use client';

export function SignOutButton(): React.JSX.Element {
  return (
    <button
      style={{ cursor: 'pointer', marginLeft: '0.5rem' }}
      type="button"
      onClick={() => {
        void (async () => {
          await fetch('/api/auth/callback', { method: 'DELETE' });
          window.location.href = '/';
        })();
      }}
    >
      Sign out
    </button>
  );
}
