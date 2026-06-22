import type { DemoMode } from '@agent-platform/agent-client';

export type AuthProbePreset = 'full' | 'no_iam' | 'iam_only' | 'no_session';

const LAYER_SESSION = 'Web session';
const LAYER_IAM = 'Cloud Run IAM';
const LAYER_A2A = 'A2A OAuth';
const LAYER_MCP = 'MCP delegation';
const DETAIL_SESSION_OK = 'OAuth session active';
const DETAIL_SESSION_FAIL = 'Sign in required';
const DETAIL_MCP_SKIP = 'Use direct proof for bq-mcp trace';
const DETAIL_A2A_TOKEN = 'Delegated user access token';
const DETAIL_IAM = 'run.invoker + identity token';

type AuthLayerStatus = 'ok' | 'skipped' | 'fail' | 'unknown';

export type AuthLayer = {
  id: string;
  label: string;
  status: AuthLayerStatus;
  detail: string;
};

export type AuthTraceInput = {
  useRemoteAgent: boolean;
  demoMode: DemoMode | null;
  httpOk: boolean;
  httpStatus?: number | null;
  error: string | null;
  reply: string | null;
  probePreset?: AuthProbePreset | null;
};

export function parseHttpStatusFromError(error: string | null): number | null {
  if (!error) {
    return null;
  }
  const match = error.match(/HTTP (\d{3})/i);
  return match ? Number(match[1]) : null;
}

function resolveHttpStatus(input: AuthTraceInput): number | null {
  if (input.httpStatus != null) {
    return input.httpStatus;
  }
  return parseHttpStatusFromError(input.error);
}

function fullProfileLayerStatuses(
  httpOk: boolean,
  httpStatus: number | null,
): { iam: AuthLayerStatus; a2a: AuthLayerStatus; a2aDetail: string } {
  if (httpOk) {
    return { iam: 'ok', a2a: 'ok', a2aDetail: DETAIL_A2A_TOKEN };
  }
  if (httpStatus === 403) {
    return { iam: 'fail', a2a: 'skipped', a2aDetail: 'Stopped at IAM gate' };
  }
  if (httpStatus === 401) {
    return { iam: 'ok', a2a: 'fail', a2aDetail: 'No user OAuth token sent' };
  }
  return { iam: 'fail', a2a: 'skipped', a2aDetail: 'Stopped at IAM gate' };
}

function looksLikeMcpProofReply(reply: string | null): boolean {
  if (!reply) {
    return false;
  }
  return (
    reply.includes('credential_source') ||
    reply.includes('bigquery_service_account') ||
    reply.includes('"status"')
  );
}

function inferA2aStatus(input: AuthTraceInput): AuthLayerStatus {
  if (!input.useRemoteAgent) {
    return 'skipped';
  }
  if (!input.httpOk && input.error) {
    const lower = input.error.toLowerCase();
    if (
      lower.includes('session expired') ||
      lower.includes('token') ||
      lower.includes('forbidden') ||
      lower.includes('401') ||
      lower.includes('403')
    ) {
      return 'fail';
    }
    return 'unknown';
  }
  return input.httpOk ? 'ok' : 'unknown';
}

function inferMcpStatus(input: AuthTraceInput): AuthLayerStatus {
  if (!input.useRemoteAgent) {
    return 'skipped';
  }
  if (input.demoMode !== 'direct' && !looksLikeMcpProofReply(input.reply)) {
    return 'skipped';
  }
  if (!input.httpOk) {
    return 'fail';
  }
  return input.demoMode === 'direct' || looksLikeMcpProofReply(input.reply) ? 'ok' : 'skipped';
}

function buildProbeAuthTrace(input: AuthTraceInput): AuthLayer[] {
  const preset = input.probePreset;
  if (!preset) {
    return [];
  }

  const mcpSkipped: AuthLayer = {
    id: 'mcp',
    label: LAYER_MCP,
    status: 'skipped',
    detail: DETAIL_MCP_SKIP,
  };

  if (preset === 'no_session') {
    return [
      {
        id: 'session',
        label: LAYER_SESSION,
        status: 'fail',
        detail: DETAIL_SESSION_FAIL,
      },
      {
        id: 'iam',
        label: LAYER_IAM,
        status: 'skipped',
        detail: 'Probe stopped at web session',
      },
      {
        id: 'a2a',
        label: LAYER_A2A,
        status: 'skipped',
        detail: 'Probe stopped at web session',
      },
      mcpSkipped,
    ];
  }

  if (preset === 'no_iam') {
    return [
      {
        id: 'session',
        label: LAYER_SESSION,
        status: 'ok',
        detail: DETAIL_SESSION_OK,
      },
      {
        id: 'iam',
        label: LAYER_IAM,
        status: input.httpOk ? 'ok' : 'fail',
        detail: 'No identity token sent',
      },
      {
        id: 'a2a',
        label: LAYER_A2A,
        status: 'skipped',
        detail: 'Probe stopped at IAM gate',
      },
      mcpSkipped,
    ];
  }

  if (preset === 'iam_only') {
    return [
      {
        id: 'session',
        label: LAYER_SESSION,
        status: 'ok',
        detail: DETAIL_SESSION_OK,
      },
      {
        id: 'iam',
        label: LAYER_IAM,
        status: 'ok',
        detail: DETAIL_IAM,
      },
      {
        id: 'a2a',
        label: LAYER_A2A,
        status: input.httpOk ? 'ok' : 'fail',
        detail: input.httpOk ? DETAIL_A2A_TOKEN : 'No user OAuth token sent',
      },
      mcpSkipped,
    ];
  }

  const mcpLayer: AuthLayer =
    input.httpOk && looksLikeMcpProofReply(input.reply)
      ? {
          id: 'mcp',
          label: LAYER_MCP,
          status: 'ok',
          detail: 'x-user-access-token to bq-mcp',
        }
      : mcpSkipped;

  const { iam, a2a, a2aDetail } = fullProfileLayerStatuses(input.httpOk, resolveHttpStatus(input));

  return [
    {
      id: 'session',
      label: LAYER_SESSION,
      status: 'ok',
      detail: DETAIL_SESSION_OK,
    },
    {
      id: 'iam',
      label: LAYER_IAM,
      status: iam,
      detail: DETAIL_IAM,
    },
    {
      id: 'a2a',
      label: LAYER_A2A,
      status: a2a,
      detail: a2a === 'skipped' ? a2aDetail : DETAIL_A2A_TOKEN,
    },
    mcpLayer,
  ];
}

export function buildAuthTrace(input: AuthTraceInput): AuthLayer[] {
  if (input.probePreset) {
    return buildProbeAuthTrace(input);
  }

  const sessionStatus: AuthLayerStatus =
    !input.httpOk && input.error?.toLowerCase().includes('session expired')
      ? 'fail'
      : input.error && !input.httpOk
        ? 'unknown'
        : 'ok';

  const iamStatus: AuthLayerStatus = !input.useRemoteAgent
    ? 'skipped'
    : !input.httpOk && input.error?.includes('403')
      ? 'fail'
      : input.httpOk
        ? 'ok'
        : 'unknown';

  const a2aStatus = inferA2aStatus(input);
  const mcpStatus = inferMcpStatus(input);

  return [
    {
      id: 'session',
      label: LAYER_SESSION,
      status: sessionStatus,
      detail: sessionStatus === 'ok' ? DETAIL_SESSION_OK : DETAIL_SESSION_FAIL,
    },
    {
      id: 'iam',
      label: LAYER_IAM,
      status: iamStatus,
      detail: iamStatus === 'skipped' ? 'Not used in local mode' : DETAIL_IAM,
    },
    {
      id: 'a2a',
      label: LAYER_A2A,
      status: a2aStatus,
      detail: a2aStatus === 'skipped' ? 'Not used in local mode' : DETAIL_A2A_TOKEN,
    },
    {
      id: 'mcp',
      label: LAYER_MCP,
      status: mcpStatus,
      detail: mcpStatus === 'skipped' ? DETAIL_MCP_SKIP : 'x-user-access-token to bq-mcp',
    },
  ];
}
