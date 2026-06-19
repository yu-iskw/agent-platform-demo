export { extractTextFromMessage } from './a2a-message.js';
export {
  buildA2aDemoMetadata,
  parseA2aDemoMetadata,
  DEMO_ACTION_KEY,
  DEMO_MODE_KEY,
  DEMO_PROJECT_ID_KEY,
  type A2aDemoMetadata,
  type DemoAction,
  type DemoMode,
} from './a2a-demo-metadata.js';
export { buildMcpCallerHeaders } from './build-mcp-caller-headers.js';
export { resolveDelegatedUserAccessToken } from './delegated-access-token.js';
export { getEmailFromGoogleAccessToken } from './google-access-token.js';
export { getHttpHeader } from './http-header.js';
export { parseGoogleIdToken, type GoogleIdTokenClaims } from './google-id-token.js';
export { createOAuth2ClientWithAccessToken, getOAuth2Client } from './oauth2-client.js';
export { resolvePrmResourceUrl, writeProtectedResourceMetadata } from './mcp-auth-middleware.js';
export { authRouteRateLimit } from './rate-limit.js';
export {
  createGoogleUserAuthMiddleware,
  type GoogleUserAuthMiddlewareOptions,
  type GoogleUserContext,
} from './session-auth-middleware.js';
export { extractBearerToken, SESSION_AUTHORIZATION_HEADER } from './session-jwt.js';
export {
  assertServiceAuthModeAllowed,
  fetchCloudRunIdToken,
  looksLikeJwtIdToken,
  verifyCloudRunCaller,
  verifyMcpServiceCaller,
  type ServiceAuthOptions,
  type ServiceCallerIdentity,
} from './service-auth.js';
export { getUserAccessTokenFromHeaders, USER_ACCESS_TOKEN_HEADER } from './user-access-token.js';
