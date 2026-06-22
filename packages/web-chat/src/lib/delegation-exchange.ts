/** True when remote-agent and bq-mcp are expected to mint/verify delegation JWTs (DELEGATION_JWT_SECRET). */
export function isDelegationExchangeAvailable(): boolean {
  return process.env.DELEGATION_JWT_EXCHANGE === 'true';
}
