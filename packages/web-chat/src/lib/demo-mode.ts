import type { DemoAction, DemoMode } from '@agent-platform/agent-client';

export type { DemoMode };

export const DEMO_MODE_COOKIE = 'demo_mode';

export function parseDemoMode(value: string | undefined): DemoMode {
  return value === 'direct' ? 'direct' : 'agent';
}

export function resolveRemoteDemoRequest(input: {
  cookieMode: DemoMode;
  useRemoteAgent: boolean;
  routedAgentId: string;
  demoAction: DemoAction | undefined;
  projectIdEnv: string | undefined;
}): {
  mode: DemoMode;
  demoAction: DemoAction | undefined;
  demoProjectId: string | undefined;
  error?: string;
} {
  if (!input.useRemoteAgent) {
    return { mode: 'agent', demoAction: undefined, demoProjectId: undefined };
  }

  const mode =
    input.cookieMode === 'direct' && input.routedAgentId === 'bigquery' ? 'direct' : 'agent';

  if (input.cookieMode === 'direct' && input.demoAction && mode !== 'direct') {
    return {
      mode,
      demoAction: undefined,
      demoProjectId: undefined,
      error: 'Direct tool mode requires the BigQuery agent',
    };
  }

  if (mode === 'direct' && !input.demoAction) {
    return {
      mode,
      demoAction: undefined,
      demoProjectId: undefined,
      error: 'Direct tool mode requires a preset demoAction from the proof buttons',
    };
  }

  return {
    mode,
    demoAction: mode === 'direct' ? input.demoAction : undefined,
    demoProjectId:
      mode === 'direct' && input.demoAction === 'list_datasets' ? input.projectIdEnv : undefined,
  };
}
