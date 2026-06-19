import { OAuth2Client } from 'google-auth-library';

let sharedOAuth2Client: OAuth2Client | undefined;

export function getOAuth2Client(): OAuth2Client {
  sharedOAuth2Client ??= new OAuth2Client();
  return sharedOAuth2Client;
}

export function createOAuth2ClientWithAccessToken(accessToken: string): OAuth2Client {
  const client = new OAuth2Client();
  client.setCredentials({ access_token: accessToken });
  return client;
}
