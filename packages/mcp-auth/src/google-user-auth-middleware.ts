import { resolveDelegatedUserAccessToken } from './delegated-access-token.js';
import { getEmailFromGoogleAccessToken } from './google-access-token.js';

import type { AsyncLocalStorage } from 'node:async_hooks';

export type CredentialSource = 'user_oauth_access_token' | 'delegation_jwt';

export type GoogleUserContext = {
  email: string;
  googleAccessToken?: string;
  credentialSource: CredentialSource;
  credentialIssuer?: string;
  credentialAudience?: string;
};

export type GoogleUserAuthMiddlewareOptions = {
  userContext?: AsyncLocalStorage<GoogleUserContext>;
};

type GoogleUserAuthRequest = {
  headers: Record<string, string | string[] | undefined>;
};

type GoogleUserAuthResponse = {
  status(code: number): { json(body: unknown): void };
};

type GoogleUserAuthNext = () => void;

export function createGoogleUserAuthMiddleware(
  options: GoogleUserAuthMiddlewareOptions,
): (
  req: GoogleUserAuthRequest,
  res: GoogleUserAuthResponse,
  next: GoogleUserAuthNext,
) => Promise<void> {
  return async (req, res, next): Promise<void> => {
    const token = resolveDelegatedUserAccessToken(req.headers, {
      excludeJwtFromAuthorization: true,
    });
    if (!token) {
      res.status(401).json({ error: 'Missing Google access token' });
      return;
    }

    try {
      const email = await getEmailFromGoogleAccessToken(token);
      const context: GoogleUserContext = {
        email,
        googleAccessToken: token,
        credentialSource: 'user_oauth_access_token',
      };

      if (options.userContext) {
        options.userContext.run(context, next);
        return;
      }

      next();
    } catch {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
}
