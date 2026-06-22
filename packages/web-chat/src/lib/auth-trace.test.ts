import { describe, expect, it } from 'vitest';

import { rejectNonFullFreeformChat } from './auth-probe.js';
import { buildAuthTrace } from './auth-trace.js';
import { resolveRemoteDemoRequest } from './demo-mode.js';

describe('rejectNonFullFreeformChat', () => {
  it('blocks remote free-form chat when auth profile is not full', () => {
    expect(
      rejectNonFullFreeformChat({
        useRemoteAgent: true,
        demoAction: undefined,
        authPreset: 'no_iam',
      }),
    ).toContain('Full auth profile');
  });

  it('allows remote proof actions with non-full profile', () => {
    expect(
      rejectNonFullFreeformChat({
        useRemoteAgent: true,
        demoAction: 'list_datasets',
        authPreset: 'no_iam',
      }),
    ).toBeNull();
  });

  it('ignores profile in local mode', () => {
    expect(
      rejectNonFullFreeformChat({
        useRemoteAgent: false,
        demoAction: undefined,
        authPreset: 'no_iam',
      }),
    ).toBeNull();
  });
});

describe('parseAuthProbePreset', () => {
  it('accepts known presets', async () => {
    const { parseAuthProbePreset } = await import('./auth-probe.js');
    expect(parseAuthProbePreset('full')).toBe('full');
    expect(parseAuthProbePreset('no_iam')).toBe('no_iam');
  });
});

describe('resolveRemoteDemoRequest', () => {
  it('allows local chat when direct cookie is set without demoAction', () => {
    const result = resolveRemoteDemoRequest({
      cookieMode: 'direct',
      useRemoteAgent: false,
      routedAgentId: 'bigquery',
      demoAction: undefined,
      projectIdEnv: 'demo-project',
    });

    expect(result.error).toBeUndefined();
    expect(result.mode).toBe('agent');
  });

  it('requires demoAction for remote direct mode', () => {
    const result = resolveRemoteDemoRequest({
      cookieMode: 'direct',
      useRemoteAgent: true,
      routedAgentId: 'bigquery',
      demoAction: undefined,
      projectIdEnv: 'demo-project',
    });

    expect(result.error).toContain('preset demoAction');
  });
});

describe('buildAuthTrace', () => {
  it('skips remote layers in local mode', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: false,
      demoMode: null,
      httpOk: true,
      error: null,
      reply: 'local reply',
    });

    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('skipped');
    expect(layers.find((layer) => layer.id === 'a2a')?.status).toBe('skipped');
  });

  it('marks IAM fail for no_iam probe with 403', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk: false,
      error: 'Agent policy fetch failed (HTTP 403)',
      reply: null,
      probePreset: 'no_iam',
    });

    expect(layers.find((layer) => layer.id === 'session')?.status).toBe('ok');
    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('fail');
    expect(layers.find((layer) => layer.id === 'a2a')?.status).toBe('skipped');
  });

  it('marks session fail for no_session probe', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk: false,
      error: 'Session required',
      reply: null,
      probePreset: 'no_session',
    });

    expect(layers.find((layer) => layer.id === 'session')?.status).toBe('fail');
    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('skipped');
  });

  it('marks A2A fail for iam_only probe with 401', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk: false,
      error: 'Agent policy fetch failed (HTTP 401)',
      reply: null,
      probePreset: 'iam_only',
    });

    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('ok');
    expect(layers.find((layer) => layer.id === 'a2a')?.status).toBe('fail');
  });

  it('marks remote layers ok for full probe success', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk: true,
      error: null,
      reply: null,
      probePreset: 'full',
    });

    expect(layers.find((layer) => layer.id === 'session')?.status).toBe('ok');
    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('ok');
    expect(layers.find((layer) => layer.id === 'a2a')?.status).toBe('ok');
    expect(layers.find((layer) => layer.id === 'mcp')?.status).toBe('skipped');
  });

  it('marks MCP ok for full profile proof reply', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: 'direct',
      httpOk: true,
      error: null,
      reply: '{"credential_source":"user_oauth_access_token"}',
      probePreset: 'full',
    });

    expect(layers.find((layer) => layer.id === 'mcp')?.status).toBe('ok');
  });

  it('marks IAM fail and A2A skipped for full probe with 403', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk: false,
      httpStatus: 403,
      error: 'Agent policy fetch failed (HTTP 403)',
      reply: null,
      probePreset: 'full',
    });

    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('fail');
    expect(layers.find((layer) => layer.id === 'a2a')?.status).toBe('skipped');
  });

  it('marks A2A fail for full probe with 401', () => {
    const layers = buildAuthTrace({
      useRemoteAgent: true,
      demoMode: null,
      httpOk: false,
      httpStatus: 401,
      error: 'Agent policy fetch failed (HTTP 401)',
      reply: null,
      probePreset: 'full',
    });

    expect(layers.find((layer) => layer.id === 'iam')?.status).toBe('ok');
    expect(layers.find((layer) => layer.id === 'a2a')?.status).toBe('fail');
  });
});
