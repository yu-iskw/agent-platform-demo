export function getGoogleAccessTokenFromEnv(): string {
  const token = process.env.GOOGLE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'GOOGLE_ACCESS_TOKEN is required.\n' +
        '  ./scripts/agent-cli.sh "<message>"\n' +
        '  export GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token)"',
    );
  }

  return token;
}
