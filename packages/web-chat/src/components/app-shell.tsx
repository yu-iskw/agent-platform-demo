'use client';

type AppShellProps = {
  control: React.ReactNode;
  operation: React.ReactNode;
};

export function AppShell({ control, operation }: AppShellProps): React.JSX.Element {
  return (
    <div
      style={{
        alignItems: 'start',
        display: 'grid',
        gap: '1.5rem',
        gridTemplateColumns: 'minmax(280px, 320px) 1fr',
        marginTop: '1rem',
      }}
    >
      <aside style={{ position: 'sticky', top: '1rem' }}>{control}</aside>
      <section>{operation}</section>
    </div>
  );
}
