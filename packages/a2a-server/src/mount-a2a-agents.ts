import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import {
  A2AExpressApp,
  UserBuilder,
  agentCardHandler,
  jsonRpcHandler,
} from '@a2a-js/sdk/server/express';
import { normalizeBaseUrl } from '@agent-platform/agent-client';
import { json } from 'express';

import type { AgentDefinition } from './agent-definition.js';
import type { AgentPolicyStore } from './agent-policy-store.js';
import type { RequestHandler, Application } from 'express';

const AGENT_CARD_FILENAME = 'agent-card.json';
const LEGACY_AGENT_CARD_PATH = '/.well-known/agent-card.json';
const API_CATALOG_PATH = '/.well-known/api-catalog';
const AGENT_POLICY_PATH = '/agent-policy';

type ApiCatalogLink = {
  href: string;
  type: string;
  title?: string;
};

type ApiCatalogEntry = {
  anchor: string;
  describedby: ApiCatalogLink[];
};

type ApiCatalog = {
  linkset: ApiCatalogEntry[];
};

export type MountA2aAgentsOptions = {
  publicBaseUrl: string;
  authMiddleware: RequestHandler;
  definitions: AgentDefinition[];
  policy: AgentPolicyStore;
};

function buildApiCatalog(publicBaseUrl: string, policy: AgentPolicyStore): ApiCatalog {
  const base = normalizeBaseUrl(publicBaseUrl);

  return {
    linkset: policy.getEnabledDefinitions().map((definition) => {
      const anchor = `${base}${definition.mountPath}`;
      return {
        anchor,
        describedby: [
          {
            href: `${anchor}/${AGENT_CARD_FILENAME}`,
            type: 'application/json',
            title: `Agent Card for ${definition.id}`,
          },
        ],
      };
    }),
  };
}

function createEnabledGuard(policy: AgentPolicyStore, agentId: string): RequestHandler {
  return (_req, res, next) => {
    if (!policy.isEnabled(agentId)) {
      res.status(404).json({ error: 'Agent disabled' });
      return;
    }
    next();
  };
}

function mountLegacyRootRoutes(
  app: Application,
  options: MountA2aAgentsOptions,
  definition: AgentDefinition,
): void {
  const { authMiddleware, policy } = options;
  const enabledGuard = createEnabledGuard(policy, definition.id);
  const legacyStack: RequestHandler[] = [authMiddleware, enabledGuard];
  const buildLegacyCard = definition.buildLegacyCard ?? definition.buildCard;
  const legacyCard = buildLegacyCard(normalizeBaseUrl(options.publicBaseUrl));
  const requestHandler = new DefaultRequestHandler(
    legacyCard,
    new InMemoryTaskStore(),
    definition.createExecutor(),
  );
  const legacyJsonRpc = jsonRpcHandler({
    requestHandler,
    userBuilder: UserBuilder.noAuthentication,
  });

  // Path-specific legacy routes only — do not mount A2AExpressApp at '' or its
  // middleware intercepts unrelated paths such as /agents/general/agent-card.json.
  app.get(
    LEGACY_AGENT_CARD_PATH,
    ...legacyStack,
    agentCardHandler({ agentCardProvider: requestHandler }),
  );
  app.post('/', ...legacyStack, legacyJsonRpc);
}

function mountAgentRoutes(
  app: Application,
  options: MountA2aAgentsOptions,
  definition: AgentDefinition,
): void {
  const { authMiddleware, policy } = options;
  const enabledGuard = createEnabledGuard(policy, definition.id);
  const agentCard = definition.buildCard(options.publicBaseUrl);
  const requestHandler = new DefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    definition.createExecutor(),
  );
  const a2aApp = new A2AExpressApp(requestHandler);

  // @a2a-js/sdk types target Express 4; runtime uses Express 5.
  a2aApp.setupRoutes(
    app as never,
    definition.mountPath,
    [authMiddleware as never, enabledGuard as never],
    AGENT_CARD_FILENAME,
  );

  if (definition.legacyRoot) {
    mountLegacyRootRoutes(app, options, definition);
  }
}

function mountAgentPolicyRoutes(
  app: Application,
  authMiddleware: RequestHandler,
  policy: AgentPolicyStore,
): void {
  app.get(AGENT_POLICY_PATH, authMiddleware, (_req, res) => {
    res.json({ agents: policy.list() });
  });

  app.patch(AGENT_POLICY_PATH, authMiddleware, json(), (req, res) => {
    const body = req.body as { agentId?: string; enabled?: boolean };
    const agentId = body.agentId?.trim();
    const { enabled } = body;

    if (!agentId || typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'agentId and enabled (boolean) are required' });
      return;
    }

    try {
      policy.setEnabled(agentId, enabled);
      res.json({ agents: policy.list() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Policy update failed';
      res.status(400).json({ error: message });
    }
  });
}

export function mountA2aAgents(app: Application, options: MountA2aAgentsOptions): void {
  const { policy, definitions } = options;

  app.get(API_CATALOG_PATH, (_req, res) => {
    res.type('application/linkset+json').json(buildApiCatalog(options.publicBaseUrl, policy));
  });

  mountAgentPolicyRoutes(app, options.authMiddleware, policy);

  for (const definition of definitions) {
    mountAgentRoutes(app, options, definition);
  }
}
