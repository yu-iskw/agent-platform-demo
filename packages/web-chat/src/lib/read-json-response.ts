export async function readJsonResponse<T>(response: Response, context: string): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (text.trimStart().startsWith('<') && !contentType.includes('application/json')) {
    throw new Error(
      `${context} returned HTML (HTTP ${response.status}). ` +
        'Check AGENT_URL, run ./scripts/proxy-agent.sh for Cloud Run, or redeploy remote-agent.',
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${context} returned non-JSON (HTTP ${response.status})`);
  }
}
