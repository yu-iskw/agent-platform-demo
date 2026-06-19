import { getOAuth2Client } from './oauth2-client.js';

type TokenInfoCacheEntry = {
  email: string;
  expiresAt: number;
};

const tokenInfoCache = new Map<string, TokenInfoCacheEntry>();
const TOKEN_INFO_CACHE_MAX_ENTRIES = 256;

function rememberTokenEmail(accessToken: string, email: string, expiresAt: number): void {
  if (tokenInfoCache.size >= TOKEN_INFO_CACHE_MAX_ENTRIES) {
    const oldestKey = tokenInfoCache.keys().next().value;
    if (oldestKey) {
      tokenInfoCache.delete(oldestKey);
    }
  }

  tokenInfoCache.set(accessToken, { email, expiresAt });
}

export async function getEmailFromGoogleAccessToken(accessToken: string): Promise<string> {
  const cached = tokenInfoCache.get(accessToken);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.email;
  }

  const client = getOAuth2Client();
  const info = await client.getTokenInfo(accessToken);
  const tokenEmail = info.email?.trim().toLowerCase();

  if (!tokenEmail) {
    throw new Error('Google access token has no email');
  }

  const expiresAt =
    typeof info.expiry_date === 'number' && info.expiry_date > Date.now()
      ? info.expiry_date
      : Date.now() + 5 * 60 * 1000;
  rememberTokenEmail(accessToken, tokenEmail, expiresAt);

  return tokenEmail;
}
