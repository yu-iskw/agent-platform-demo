# Terraform — A2A + MCP demo foundation

Provisions **foundation only** for your GCP project (`project_id` in tfvars). Cloud Run services are deployed via shell scripts in `../scripts/`.

## What this creates

- Enabled APIs: Cloud Run, Artifact Registry, BigQuery, IAM Credentials, Vertex AI, IAP
- Service accounts: `remote-agent-sa`, `bq-mcp-sa`, `bq-metadata-reader`
- IAM:
  - `remote-agent-sa` → `roles/aiplatform.user`
  - `bq-metadata-reader` → `roles/bigquery.metadataViewer`
  - `bq_impersonation_principals` (+ `bq-mcp-sa` automatically) → `roles/iam.serviceAccountTokenCreator` on `bq-metadata-reader`
- Artifact Registry repository for container images
- Optional IAP OAuth brand + client for local `web-chat` (requires `iap_support_email`)

## What this does **not** create

- Cloud Run services (`bq-mcp`, `remote-agent`) — use `scripts/deploy-mcp.sh` and `scripts/deploy-agent.sh`
- `roles/run.invoker` on Cloud Run services — granted by deploy scripts after services exist

## Google SSO and callback URLs

OAuth uses **two Google OAuth clients**:

| Client type                            | Terraform output          | Used by                                       |
| -------------------------------------- | ------------------------- | --------------------------------------------- |
| **Web application** (IAP or Console)   | `web_oauth_redirect_uris` | web-chat, Claude Desktop, Cursor Cloud Agents |
| **Desktop application** (Console only) | `mcp_oauth_redirect_uris` | Cursor IDE, Claude Code, Codex Desktop        |

Remote-agent and bq-mcp do not expose `/oauth/callback` routes. bq-mcp publishes PRM at `/.well-known/oauth-protected-resource`; IDEs complete OAuth against Google and return tokens to their own callback URIs.

### Web OAuth client (web-chat + hosted IDE callbacks)

Terraform provisions an **IAP OAuth client** for legacy compatibility, but **web-chat requires a separate Web application client** because IAP clients cannot register `http://localhost:3000/api/auth/callback`.

```bash
./scripts/setup-web-oauth.sh
```

Create the client in [GCP Console → Credentials](https://console.cloud.google.com/apis/credentials) and register every URI from:

```bash
terraform output web_oauth_redirect_uris
```

Set in `terraform/terraform.tfvars` (single source of truth):

```hcl
web_oauth_client_id   = "YOUR_CLIENT_ID.apps.googleusercontent.com"
web_oauth_client_type = "desktop"  # desktop = PKCE, no secret; web = requires secret below
# web_oauth_client_secret = "GOCSPX-..."  # only when web_oauth_client_type = "web"
```

Then `terraform apply` and `./scripts/run-web-chat.sh`.

`run-web-chat.sh` reads OAuth from terraform outputs into process env. `packages/web-chat/.env.local` holds runtime config only:

```bash
OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback   # must match Console exactly
AGENT_URL=<Cloud Run remote-agent URL>
```

Add production web-chat URIs to `web_oauth_redirect_uris` in `terraform.tfvars` when hosting (e.g. `https://chat.example.com/api/auth/callback`).

### Desktop OAuth client (IDE MCP)

Google does **not** allow Terraform to create standard Desktop OAuth clients. Create one manually:

1. [GCP Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials** → **OAuth client ID** → **Desktop app**
2. Register every URI from:

```bash
terraform output mcp_oauth_redirect_uris
terraform output -raw claude_code_oauth_callback_port
```

Default Desktop URIs:

| URI                                            | Client                       |
| ---------------------------------------------- | ---------------------------- |
| `cursor://anysphere.cursor-mcp/oauth/callback` | Cursor IDE                   |
| `http://localhost:54321/callback`              | Claude Code (pinned port)    |
| `http://127.0.0.1:54321/callback`              | Claude Code (alternate host) |
| `codex://connector/oauth_callback`             | Codex Desktop connectors     |

3. **Per developer:** export Desktop OAuth client ID (public identifier; do not commit the literal value):

```bash
export MCP_GOOGLE_OAUTH_CLIENT_ID="YOUR_DESKTOP_CLIENT_ID.apps.googleusercontent.com"
# or, if stored in terraform.tfvars:
export MCP_GOOGLE_OAUTH_CLIENT_ID=$(terraform output -raw mcp_oauth_client_id)
```

4. **Connect by IDE:**

| IDE             | Config                                    | Notes                                                                                   |
| --------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| **Cursor**      | [`.cursor/mcp.json`](../.cursor/mcp.json) | Requires `oauth.clientId` = `${env:MCP_GOOGLE_OAUTH_CLIENT_ID}` — Google has no MCP DCR |
| **Claude Code** | [`.mcp.json`](../.mcp.json) or CLI below  | URL + `callbackPort` only                                                               |

**Claude Code** — checked-in [`.mcp.json`](../.mcp.json) or CLI:

```bash
claude mcp add bq-mcp http://127.0.0.1:8080/mcp \
  --transport http \
  --callback-port $(cd terraform && terraform output -raw claude_code_oauth_callback_port)

claude mcp add remote-agent http://127.0.0.1:8081/mcp \
  --transport http \
  --callback-port $(cd terraform && terraform output -raw claude_code_oauth_callback_port)
```

For Cloud Run, run [`../scripts/proxy-mcp.sh`](../scripts/proxy-mcp.sh) and [`../scripts/proxy-agent.sh`](../scripts/proxy-agent.sh) before connecting. PRM `resource` matches localhost when accessed through the proxy.

5. **Optional (Cursor fallback):** if `oauth.clientId` env interpolation fails, use legacy `auth.CLIENT_ID` with the same env var (see [README Use case B](../README.md#use-case-b-cursor--claude-code--mcp)).

Optional: store client ID in `terraform.tfvars` for `terraform output`:

```hcl
mcp_oauth_client_id     = "YOUR_DESKTOP_CLIENT_ID.apps.googleusercontent.com"
mcp_oauth_client_secret = "YOUR_DESKTOP_CLIENT_SECRET"
```

Desktop app secrets are often unused (PKCE public client). Not required for Claude Code.

**Not registered for Google OAuth:** Codex CLI `http://localhost:1455/auth/callback` is OpenAI ChatGPT sign-in only, not a Google MCP callback.

### Remote-agent and MCP (no server-side OAuth callback)

Deploy scripts set public service URLs after Cloud Run deploy:

| Env var                       | Set by                             | Purpose                                                                               |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| `MCP_RESOURCE_URL`            | `deploy-mcp.sh`                    | MCP `/.well-known/oauth-protected-resource` metadata                                  |
| `BQ_METADATA_READER_SA_EMAIL` | `deploy-mcp.sh`, `deploy-agent.sh` | SA impersonated for BigQuery `list_datasets`; agent uses for credential introspection |
| `PUBLIC_AGENT_URL`            | `deploy-agent.sh`                  | A2A agent card URL                                                                    |
| `MCP_SERVER_URL`              | `deploy-agent.sh`                  | Agent → MCP connection (auto-detected)                                                |

User Google SSO flows: sign in on web-chat (or run `agent-cli` with `GOOGLE_ACCESS_TOKEN` from gcloud) → access token delegated to agent for identity → agent forwards to MCP → MCP impersonates `bq-metadata-reader` for BigQuery.

### BigQuery impersonation principals

Set `bq_impersonation_principals` in `terraform.tfvars` with IAM members who may impersonate `bq-metadata-reader` (e.g. `user:you@example.com` for local dev). `bq-mcp-sa` is granted automatically.

```bash
terraform output -raw bq_metadata_reader_sa_email
```

## Usage

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars (allowed_emails for run.invoker IAM, bq_impersonation_principals, iap_support_email, web_oauth_redirect_uris, mcp_oauth_client_id)
terraform init
terraform plan
terraform apply
```

### OAuth client fallback

If `google_iap_brand` fails (missing org permissions), create an OAuth 2.0 **Web application** client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) with redirect URIs from:

```bash
terraform output web_oauth_redirect_uris
```

Set `web_oauth_client_id` (and `web_oauth_client_type` / `web_oauth_client_secret` if needed) in `terraform/terraform.tfvars`, then `terraform apply` and `./scripts/run-web-chat.sh`.

## Outputs used by deploy scripts

```bash
terraform output -raw project_id
terraform output -raw region
terraform output -raw artifact_registry_url
terraform output -raw remote_agent_sa_email
terraform output -raw bq_mcp_sa_email
terraform output -raw bq_metadata_reader_sa_email
terraform output -raw oauth_client_id
terraform output web_oauth_redirect_uris
terraform output mcp_oauth_redirect_uris
terraform output -raw mcp_oauth_client_id
terraform output -raw claude_code_oauth_callback_port
```
