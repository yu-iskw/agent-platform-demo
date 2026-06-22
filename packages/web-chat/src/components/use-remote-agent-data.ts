'use client';

import { pickEnabledAgentId } from '@agent-platform/agent-client/pick-enabled-agent-id';
import { useCallback, useEffect, useState } from 'react';

import { type AgentPolicyRow } from '@/components/agent-availability-panel';
import { type AgentCardItem } from '@/components/agent-card-picker';
import { type PlatformInfo } from '@/lib/platform-info';
import { readJsonResponse } from '@/lib/read-json-response';

type AgentListItem = AgentCardItem & {
  serviceUrl: string;
};

type AgentsResponse = {
  agents?: AgentListItem[];
  error?: string;
};

type PolicyResponse = {
  agents?: AgentPolicyRow[];
  error?: string;
};

async function fetchAgents(signal: AbortSignal): Promise<AgentListItem[]> {
  const response = await fetch('/api/agents', { signal });
  const data = await readJsonResponse<AgentsResponse>(response, 'Agents API');
  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to load agents');
  }
  return data.agents ?? [];
}

async function fetchPolicy(signal: AbortSignal): Promise<AgentPolicyRow[]> {
  const response = await fetch('/api/agent-policy', { signal });
  const data = await readJsonResponse<PolicyResponse>(response, 'Agent policy API');
  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to load agent policy');
  }
  return data.agents ?? [];
}

async function fetchPlatformInfo(agentId: string, signal: AbortSignal): Promise<PlatformInfo> {
  const response = await fetch(`/api/platform-info?agentId=${encodeURIComponent(agentId)}`, {
    signal,
  });
  const data = await readJsonResponse<PlatformInfo & { error?: string }>(
    response,
    'Platform info API',
  );
  if (!response.ok) {
    throw new Error(data.error ?? 'Failed to load platform info');
  }
  return data;
}

export type RemoteAgentData = {
  policyAgents: AgentPolicyRow[];
  agents: AgentListItem[];
  selectableAgents: AgentCardItem[];
  selectedAgentId: string;
  platformInfo: PlatformInfo | null;
  policyLoading: boolean;
  agentsLoading: boolean;
  platformInfoLoading: boolean;
  policyError: string | null;
  agentsError: string | null;
  platformInfoError: string | null;
  togglingId: string | null;
  setSelectedAgentId: (agentId: string) => void;
  toggleAgent: (agentId: string, enabled: boolean) => Promise<void>;
};

export function useRemoteAgentData(enabled: boolean): RemoteAgentData {
  const [policyAgents, setPolicyAgents] = useState<AgentPolicyRow[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [platformInfoLoading, setPlatformInfoLoading] = useState(false);
  const [platformInfoError, setPlatformInfoError] = useState<string | null>(null);

  const refreshAgents = useCallback(
    async (signal: AbortSignal, policy: AgentPolicyRow[]): Promise<AgentListItem[]> => {
      const discovered = await fetchAgents(signal);
      setAgents(discovered);
      setSelectedAgentId((current) => pickEnabledAgentId(current, discovered, policy));
      return discovered;
    },
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setPolicyAgents([]);
      setPolicyError(null);
      setPolicyLoading(false);
      setAgents([]);
      setAgentsError(null);
      setAgentsLoading(false);
      setSelectedAgentId('');
      setPlatformInfo(null);
      setPlatformInfoError(null);
      setPlatformInfoLoading(false);
      return;
    }

    const controller = new AbortController();
    setPolicyLoading(true);
    setAgentsLoading(true);
    setPolicyError(null);
    setAgentsError(null);

    void (async (): Promise<void> => {
      try {
        const policy = await fetchPolicy(controller.signal);
        setPolicyAgents(policy);
        setSelectedAgentId((current) => pickEnabledAgentId(current, [], policy));
        try {
          await refreshAgents(controller.signal, policy);
        } catch (refreshError) {
          if (refreshError instanceof Error && refreshError.name === 'AbortError') {
            return;
          }
          setAgents([]);
          setAgentsError(
            refreshError instanceof Error ? refreshError.message : 'Failed to load agents',
          );
          setSelectedAgentId((current) => pickEnabledAgentId(current, [], policy));
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return;
        }
        const loadMessage =
          fetchError instanceof Error ? fetchError.message : 'Failed to load remote agent info';
        setPolicyError(loadMessage);
      } finally {
        if (!controller.signal.aborted) {
          setPolicyLoading(false);
          setAgentsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [enabled, refreshAgents]);

  useEffect(() => {
    if (!enabled || !selectedAgentId || policyLoading || policyAgents.length === 0) {
      return;
    }

    const policyEntry = policyAgents.find((agent) => agent.id === selectedAgentId);
    if (policyEntry && !policyEntry.enabled) {
      setPlatformInfo(null);
      setPlatformInfoError(null);
      setPlatformInfoLoading(false);
      return;
    }

    const controller = new AbortController();
    const requestedAgentId = selectedAgentId;
    setPlatformInfoLoading(true);
    setPlatformInfoError(null);
    setPlatformInfo(null);

    void (async (): Promise<void> => {
      try {
        const info = await fetchPlatformInfo(requestedAgentId, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        setPlatformInfo(info);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return;
        }
        if (controller.signal.aborted) {
          return;
        }
        setPlatformInfoError(
          fetchError instanceof Error ? fetchError.message : 'Failed to load platform info',
        );
      } finally {
        if (!controller.signal.aborted) {
          setPlatformInfoLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [enabled, policyAgents, policyLoading, selectedAgentId]);

  async function toggleAgent(agentId: string, nextEnabled: boolean): Promise<void> {
    setTogglingId(agentId);
    setPolicyError(null);
    setAgentsError(null);
    setPlatformInfoError(null);

    try {
      const response = await fetch('/api/agent-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, enabled: nextEnabled }),
      });
      const data = await readJsonResponse<PolicyResponse>(response, 'Agent policy API');
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to update agent policy');
      }

      const policy = data.agents ?? [];
      setPolicyAgents(policy);
      setSelectedAgentId((current) => pickEnabledAgentId(current, [], policy));

      try {
        await refreshAgents(new AbortController().signal, policy);
      } catch (refreshError) {
        setAgents([]);
        setAgentsError(
          refreshError instanceof Error ? refreshError.message : 'Failed to refresh agent list',
        );
        setSelectedAgentId((current) => pickEnabledAgentId(current, [], policy));
      }
    } catch (toggleError) {
      const toggleMessage =
        toggleError instanceof Error ? toggleError.message : 'Failed to update agent policy';
      setPolicyError(toggleMessage);
    } finally {
      setTogglingId(null);
    }
  }

  return {
    policyAgents,
    agents,
    selectableAgents:
      agents.length > 0
        ? agents
        : policyAgents
            .filter((agent) => agent.enabled)
            .map((agent) => ({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              skillTags: [],
            })),
    selectedAgentId,
    platformInfo,
    policyLoading,
    agentsLoading,
    platformInfoLoading,
    policyError,
    agentsError,
    platformInfoError,
    togglingId,
    setSelectedAgentId,
    toggleAgent,
  };
}

export function chatPlaceholder(agentId: string, useRemoteAgent: boolean): string {
  if (!useRemoteAgent) {
    return 'Ask the local web-chat agent (no remote-agent A2A)';
  }
  if (!agentId) {
    return 'Loading remote agents…';
  }
  if (agentId === 'general') {
    return 'Ask a general question (no BigQuery tools)';
  }
  return 'List datasets in your GCP project';
}
