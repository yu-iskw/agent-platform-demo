import { DefaultRequestHandler, InMemoryTaskStore } from '@a2a-js/sdk/server';
import {
  A2AExpressApp,
  UserBuilder,
  agentCardHandler,
  jsonRpcHandler,
} from '@a2a-js/sdk/server/express';
import { json } from 'express';

import { buildBigQueryAgentCard } from './a2a-executor.js';
import { getAgentDefinitions } from './agent-definitions.js';
import {
  getEnabledAgentDefinitions,
  isAgentEnabled,
  listAgentPolicy,
  setAgentEnabled,
} from './agent-policy.js';

import type { AgentDefinition } from './agent-definitions.js';
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

export type ApiCatalog = {
  linkset: ApiCatalogEntry[];
};

export type MountA2aAgentsOptions = {
  publicBaseUrl: string;
  authMiddleware: RequestHandler;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export function buildApiCatalog(publicBaseUrl: string): ApiCatalog {
  const base = normalizeBaseUrl(publicBaseUrl);

  return {
    linkset: getEnabledAgentDefinitions().map((definition) => {
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

function createEnabledGuard(agentId: string): RequestHandler {
  return (_req, res, next) => {
    if (!isAgentEnabled(agentId)) {
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
  const { authMiddleware } = options;
  const enabledGuard = createEnabledGuard(definition.id);
  const legacyStack: RequestHandler[] = [authMiddleware, enabledGuard];
  const legacyCard = buildBigQueryAgentCard(normalizeBaseUrl(options.publicBaseUrl));
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
  const { authMiddleware } = options;
  const enabledGuard = createEnabledGuard(definition.id);
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

function mountAgentPolicyRoutes(app: Application, authMiddleware: RequestHandler): void {
  app.get(AGENT_POLICY_PATH, authMiddleware, (_req, res) => {
    res.json({ agents: listAgentPolicy() });
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
      setAgentEnabled(agentId, enabled);
      res.json({ agents: listAgentPolicy() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Policy update failed';
      res.status(400).json({ error: message });
    }
  });
}

export function mountA2aAgents(app: Application, options: MountA2aAgentsOptions): void {
  app.get(API_CATALOG_PATH, (_req, res) => {
    res.type('application/linkset+json').json(buildApiCatalog(options.publicBaseUrl));
  });

  mountAgentPolicyRoutes(app, options.authMiddleware);

  for (const definition of getAgentDefinitions()) {
    mountAgentRoutes(app, options, definition);
  }
}
