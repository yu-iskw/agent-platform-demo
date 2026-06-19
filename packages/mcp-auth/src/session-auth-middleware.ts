import { resolveDelegatedUserAccessToken } from './delegated-access-token.js';
import { getEmailFromGoogleAccessToken } from './google-access-token.js';

import type { AsyncLocalStorage } from 'node:async_hooks';

export type GoogleUserContext = {
  email: string;
  googleAccessToken: string;
};

export type GoogleUserAuthMiddlewareOptions = {
  userContext?: AsyncLocalStorage<GoogleUserContext>;
  onVerified?: (context: GoogleUserContext) => void;
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
    const token = resolveDelegatedUserAccessToken(req.headers);
    if (!token) {
      res.status(401).json({ error: 'Missing Google access token' });
      return;
    }

    try {
      const email = await getEmailFromGoogleAccessToken(token);
      const context: GoogleUserContext = { email, googleAccessToken: token };

      const proceed = (): void => {
        options.onVerified?.(context);
        next();
      };

      if (options.userContext) {
        options.userContext.run(context, proceed);
        return;
      }

      proceed();
    } catch {
      res.status(403).json({ error: 'Forbidden' });
    }
  };
}
