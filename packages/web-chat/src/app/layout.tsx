export const metadata = {
  title: 'Demo: Chain of Remote A2A Agent and MCP Servers',
  description: 'Remote A2A agent chained to MCP servers (BigQuery demo)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
