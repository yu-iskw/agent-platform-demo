import { createGoogleUserContextStorage } from '@agent-platform/mcp-auth';

const userContext = createGoogleUserContextStorage();

export const verifiedUserStorage = userContext.storage;
export const getVerifiedGoogleUser = userContext.getVerifiedGoogleUser;
