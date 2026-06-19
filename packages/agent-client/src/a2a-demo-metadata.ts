export const DEMO_MODE_KEY = 'demo.mode';
export const DEMO_ACTION_KEY = 'demo.action';
export const DEMO_PROJECT_ID_KEY = 'demo.projectId';

export type DemoMode = 'agent' | 'direct';

export type DemoAction = 'list_datasets' | 'get_authenticated_user';

export type A2aDemoMetadata = {
  mode: DemoMode;
  action?: DemoAction;
  projectId?: string;
};

type DemoMetadataRecord = {
  [DEMO_MODE_KEY]?: unknown;
  [DEMO_ACTION_KEY]?: unknown;
  [DEMO_PROJECT_ID_KEY]?: unknown;
};

type MessageWithMetadata = {
  metadata?: DemoMetadataRecord;
};

export function buildA2aDemoMetadata(input: {
  mode: DemoMode;
  action?: DemoAction;
  projectId?: string;
}): DemoMetadataRecord {
  if (input.mode === 'direct') {
    const metadata: DemoMetadataRecord = { 'demo.mode': input.mode };
    if (input.action) {
      metadata['demo.action'] = input.action;
    }
    if (input.projectId) {
      metadata['demo.projectId'] = input.projectId;
    }
    return metadata;
  }

  return { 'demo.mode': input.mode };
}

function isDemoAction(value: unknown): value is DemoAction {
  return value === 'list_datasets' || value === 'get_authenticated_user';
}

export function parseA2aDemoMetadata(message: MessageWithMetadata | undefined): A2aDemoMetadata {
  const metadata = message?.metadata;
  const rawMode = metadata?.['demo.mode'];

  if (rawMode === 'direct') {
    const action = metadata?.['demo.action'];
    const projectId = metadata?.['demo.projectId'];
    return {
      mode: 'direct',
      action: isDemoAction(action) ? action : undefined,
      projectId: typeof projectId === 'string' ? projectId : undefined,
    };
  }

  return { mode: 'agent' };
}
