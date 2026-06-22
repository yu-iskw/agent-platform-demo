export function looksLikeJwtIdToken(token: string): boolean {
  return token.startsWith('eyJ');
}
