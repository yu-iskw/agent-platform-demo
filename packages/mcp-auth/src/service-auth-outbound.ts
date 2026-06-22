import { GoogleAuth } from 'google-auth-library';

const idTokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function fetchCloudRunIdToken(audience: string): Promise<string> {
  const cached = idTokenCache.get(audience);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(audience);
  const token = await client.idTokenProvider.fetchIdToken(audience);
  idTokenCache.set(audience, { token, expiresAt: Date.now() + 50 * 60 * 1000 });
  return token;
}
