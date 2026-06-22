import { readJsonResponse } from '@/lib/read-json-response';

export async function persistMode(
  apiPath: string,
  mode: string,
  options: { apiLabel: string; defaultError: string },
): Promise<void> {
  const response = await fetch(apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!response.ok) {
    const data = await readJsonResponse<{ error?: string }>(response, options.apiLabel);
    throw new Error(data.error ?? options.defaultError);
  }
}
