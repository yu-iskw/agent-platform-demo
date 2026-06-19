import { GoogleAuth } from 'google-auth-library';

const DEFAULT_PROJECT = 'ubie-yu-sandbox';
const DEFAULT_LOCATION = 'asia-northeast1';
const DEFAULT_MODEL = 'gemini-2.5-flash';

type GenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

export async function runLocalChatAgent(userMessage: string, email: string): Promise<string> {
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? DEFAULT_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? DEFAULT_LOCATION;
  const model = process.env.WEB_CHAT_AGENT_MODEL ?? DEFAULT_MODEL;

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) {
    throw new Error('Failed to obtain Google Cloud access token for local agent');
  }

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: `You are the web-chat local agent for ${email}. Answer helpfully in plain text. You are running locally without remote-agent A2A — you do not have BigQuery MCP tools in this mode.`,
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Local agent request failed: ${response.status} ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as GenerateContentResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('Local agent returned an empty response');
  }
  return text;
}
