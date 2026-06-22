import { describe, expect, it } from 'vitest';

import { parseApiCatalog } from './discover-agents.js';

describe('parseApiCatalog', () => {
  it('extracts agent ids and card URLs from linkset entries', () => {
    const catalog = {
      linkset: [
        {
          anchor: 'https://example.run.app/agents/bigquery',
          describedby: [
            {
              href: 'https://example.run.app/agents/bigquery/agent-card.json',
              type: 'application/json',
            },
          ],
        },
        {
          anchor: 'https://example.run.app/agents/general',
          describedby: [
            {
              href: 'https://example.run.app/agents/general/agent-card.json',
              type: 'application/json',
            },
          ],
        },
      ],
    };

    expect(parseApiCatalog(catalog)).toEqual([
      {
        id: 'bigquery',
        serviceUrl: 'https://example.run.app/agents/bigquery',
        cardUrl: 'https://example.run.app/agents/bigquery/agent-card.json',
      },
      {
        id: 'general',
        serviceUrl: 'https://example.run.app/agents/general',
        cardUrl: 'https://example.run.app/agents/general/agent-card.json',
      },
    ]);
  });

  it('skips malformed entries', () => {
    expect(
      parseApiCatalog({
        linkset: [{ anchor: 'https://example.run.app/agents/incomplete' }, { describedby: [] }],
      }),
    ).toEqual([]);
  });
});
