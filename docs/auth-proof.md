# Auth proof playbook

Demonstrate that **web-chat** is the controlled human entry point and that identity flows through **OAuth + Cloud Run IAM + token delegation** to `remote-agent` (A2A) and `bq-mcp` (MCP).

## Architecture

```mermaid
flowchart TB
  subgraph externalGates [External gates]
    OAuthClient["Google OAuth client\nInternal or test users"]
    RunInvoker["Cloud Run IAM\nrun.invoker from allowed_emails"]
  end

  subgraph webChat [web-chat]
    Session["Session cookie\n+ googleAccessToken"]
    ChatMode["chat_mode: local | remote"]
    DemoMode["demo_mode: agent | direct\nremote only"]
  end

  subgraph remoteAgent [remote-agent]
    A2AAuth["A2A OAuth middleware"]
    DirectTools["direct-tools.ts\nbypasses LLM"]
    AgentLLM["ADK agent path"]
  end

  subgraph bqMcp [bq-mcp]
    SAVerify["verifyMcpServiceCaller"]
    UserVerify["delegated user token"]
    GetUser["get_authenticated_user"]
  end

  User --> OAuthClient --> Session
  RunInvoker --> remoteAgent
  RunInvoker --> bqMcp
  Session --> ChatMode
  ChatMode -->|local| LocalOnly["No remote calls"]
  ChatMode -->|remote| A2AAuth
  DemoMode -->|agent| AgentLLM
  DemoMode -->|direct| DirectTools
  A2AAuth --> DirectTools
  A2AAuth --> AgentLLM
  DirectTools --> SAVerify
  DirectTools --> UserVerify --> GetUser
```

```mermaid
sequenceDiagram
  participant Browser
  participant WebChat
  participant Agent as remote_agent
  participant MCP as bq_mcp

  Browser->>WebChat: Google OAuth login
  Browser->>WebChat: Set remote + direct mode
  WebChat->>Agent: A2A message/send\nSA ID token + user token\nmetadata demo.mode=direct
  Note over Agent: googleUserAuthMiddleware
  Agent->>MCP: SA ID token + x-user-access-token
  Note over MCP: verifyMcpServiceCaller + getEmailFromGoogleAccessToken
  MCP-->>Agent: get_authenticated_user JSON
  Agent-->>WebChat: formatted JSON reply
  WebChat-->>Browser: shows email + auth_mode + SA
```

### Enterprise wording (this repo)

| Term               | What it means here                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Google SSO**     | Browser OAuth to web-chat; runtime validation via `getTokenInfo` at agent/MCP                                          |
| **Cloud Run IAM**  | `allowed_emails` → `run.invoker` (network gate)                                                                        |
| **A2A with OAuth** | User token on `X-Session-Authorization` (Cloud Run) or `Authorization` (local)                                         |
| **MCP with OAuth** | PRM + delegated user token; cloud mode adds SA caller check                                                            |
| **IAP**            | Terraform provisions IAP brand/client for legacy setup; **runtime protection is IAM + OAuth**, not IAP JWT on each hop |

## Positive proofs (web UI)

The demo console uses a **control plane (left)** and **operation plane (right)**. The operation plane shows an **Auth trace** strip after each request or probe.

**Auth profile** (remote mode): toggles apply to **Prove identity** and **List datasets**; **Send** requires **Full**. Proof buttons stay available even when `agent-policy` returns 403 — fix IAM via `gcloud auth application-default login` and `allowed_emails` for Full Send. **Run probe** checks `GET /agent-policy` only.

Negative curl scenarios are also listed under **Negative checks (terminal)** in the control plane.

Prerequisites: `./scripts/run-web-chat.sh`, sign in with Google.

| Step | UI settings            | Action                                                                      | Expected                                                              |
| ---- | ---------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | Default (local)        | Send any message                                                            | Reply from local web-chat agent; no remote-agent call                 |
| 2    | Remote + Agent via LLM | Ask: _What Google account am I using and what credentials access BigQuery?_ | Natural-language answer citing your email and `bq-metadata-reader` SA |
| 3    | Remote + Direct tool   | Click **Prove identity**                                                    | JSON with `credential_source: user_oauth_access_token` and your email |
| 4    | Remote + Direct tool   | Click **List datasets**                                                     | JSON with `status` and `bigquery_service_account`                     |

Direct mode bypasses the LLM and returns raw `bq-mcp` JSON via `remote-agent` → proves delegation end-to-end.

## Negative proofs (manual curl)

Resolve your agent URL:

```bash
AGENT_URL="$(gcloud run services describe remote-agent \
  --project=YOUR_PROJECT --region=asia-northeast1 --format='value(status.url)')"
```

### 1. No auth — proves Cloud Run IAM gate

```bash
curl -s -o /dev/null -w "%{http_code}\n" "${AGENT_URL}/.well-known/api-catalog"
```

Expected: **403** (caller lacks `run.invoker` / no identity token).

### 2. IAM token only, no user OAuth — proves A2A OAuth layer

```bash
ID_TOKEN="$(gcloud auth print-identity-token --audiences="${AGENT_URL}")"
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer ${ID_TOKEN}" \
  "${AGENT_URL}/agent-policy"
```

Expected: **401** or **403** (missing delegated user access token).

### 3. Signed out web session — proves web-chat session gate

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
```

Expected: **401** (no session cookie).

## Results matrix

| Step                           | Expected status / outcome      | What it proves              |
| ------------------------------ | ------------------------------ | --------------------------- |
| Web local mode                 | Local reply                    | Remote stack not used       |
| Web remote + agent             | LLM answer with your email     | Full A2A + delegation chain |
| Web remote + direct identity   | JSON `user_oauth_access_token` | User token reached bq-mcp   |
| Web remote + direct datasets   | JSON with SA field             | BigQuery impersonation path |
| curl no auth                   | 403                            | Cloud Run IAM               |
| curl IAM only                  | 401/403                        | A2A OAuth middleware        |
| curl no session                | 401                            | Web session gate            |
| `./scripts/run-cloud-check.sh` | Smokes pass + IAM negative     | Automated regression        |

## Automated check

```bash
./scripts/run-cloud-check.sh
```

Runs two happy-path agent-cli smokes plus an unauthenticated curl that must **not** return 200.
