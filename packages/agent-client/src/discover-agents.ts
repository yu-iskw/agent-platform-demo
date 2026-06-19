import { fetchAgentCardForHost, normalizeBaseUrl } from './fetch-agent-card.js';
import { readJsonResponse } from './read-json-response.js';

import type { AgentCard } from '@a2a-js/sdk';

type ApiCatalogLink = {
  href?: string;
  type?: string;
  title?: string;
};

type ApiCatalogEntry = {
  anchor?: string;
  describedby?: ApiCatalogLink[];
};

export type ApiCatalog = {
  linkset?: ApiCatalogEntry[];
};

export type DiscoveredAgent = {
  id: string;
  serviceUrl: string;
  cardUrl: string;
  card: AgentCard;
};

export function parseApiCatalog(
  catalog: ApiCatalog,
): Array<{ id: string; serviceUrl: string; cardUrl: string }> {
  const entries = catalog.linkset ?? [];
  const agents: Array<{ id: string; serviceUrl: string; cardUrl: string }> = [];

  for (const entry of entries) {
    const serviceUrl = entry.anchor?.trim();
    const cardUrl = entry.describedby?.[0]?.href?.trim();
    if (!serviceUrl || !cardUrl) {
      continue;
    }

    const id = deriveAgentId(serviceUrl);
    if (!id) {
      continue;
    }

    agents.push({ id, serviceUrl, cardUrl });
  }

  return agents;
}

function deriveAgentId(serviceUrl: string): string | undefined {
  try {
    const pathname = new URL(serviceUrl).pathname.replace(/\/$/, '');
    const segments = pathname.split('/').filter(Boolean);
    return segments.at(-1);
  } catch {
    return undefined;
  }
}

export async function discoverAgents(hostUrl: string): Promise<DiscoveredAgent[]> {
  const catalogUrl = `${normalizeBaseUrl(hostUrl)}/.well-known/api-catalog`;
  const response = await fetch(catalogUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`API catalog fetch failed (HTTP ${response.status})`);
  }

  const catalog = await readJsonResponse<ApiCatalog>(response, 'API catalog');
  const entries = parseApiCatalog(catalog);

  const agents = await Promise.all(
    entries.map(async (entry) => {
      try {
        const card = await fetchAgentCardForHost(hostUrl, entry.id);
        return { ...entry, card };
      } catch {
        // Catalog/card can race with runtime disable; skip unavailable agents.
        return null;
      }
    }),
  );

  return agents.filter((agent): agent is DiscoveredAgent => agent !== null);
}
