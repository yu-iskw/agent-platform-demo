# Agent instructions (source of truth)

Treat this file as the **canonical** description of how to work in this repository. Tool-specific entrypoints load or import it where supported:

| Surface                         | How this repo uses `AGENTS.md`                                                                                                                                                                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cursor**                      | Root `AGENTS.md` is applied automatically; see [Cursor Rules — AGENTS.md](https://cursor.com/docs/rules). Subagent markdown also lives under `.claude/agents/` ([compatibility](https://cursor.com/docs/subagents)).                                                                                           |
| **OpenAI Codex**                | Discovered along the path from git root to cwd; see [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md/). Optional Codex-only agents: `.codex/agents/*.toml`.                                                                                                           |
| **Claude Code**                 | Does not load `AGENTS.md` by itself; root `CLAUDE.md` starts with `@AGENTS.md` per [Anthropic docs](https://docs.anthropic.com/en/docs/claude-code/claude-md#agentsmd). Hooks, skills, agents: `.claude/`.                                                                                                     |
| **Gemini CLI**                  | Listed first in `.gemini/settings.json` `context.fileName`; optional `GEMINI.md` re-exports via `@AGENTS.md`. See [GEMINI.md context](https://geminicli.com/docs/cli/gemini-md/).                                                                                                                              |
| **GitHub Copilot coding agent** | Nearest `AGENTS.md` in the tree; see [GitHub changelog](https://github.blog/changelog/2025-08-28-copilot-coding-agent-now-supports-agents-md-custom-instructions/) and [custom instructions](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/configure-coding-guidelines). |

## Project overview

Production-ready **TypeScript monorepo** template:

- **Package manager:** pnpm (workspace); see **pnpm workspace** below
- **Runtime:** Node.js (see `.node-version`)
- **Build:** tsc / pnpm scripts
- **Lint / format:** Trunk (ESLint, Prettier, and more)
- **Tests:** Vitest
- **CI/CD:** `.github/workflows/`

## Quick commands

```bash
pnpm install    # Dependencies (includes Trunk launcher; use pnpm lint/format below)
pnpm build      # Build all packages
pnpm test       # Vitest across the workspace
pnpm lint       # Trunk linters
pnpm format     # Trunk formatters
pnpm clean      # Clean build artifacts
```

## pnpm workspace

This repository is a pnpm workspace (see `pnpm-workspace.yaml`).

- **pnpm 11:** pnpm-specific config (overrides, security, `allowBuilds`, etc.) lives in **`pnpm-workspace.yaml`**, not in `package.json#pnpm` (removed in pnpm 11) or in non-auth `.npmrc` files.
- **Install:** `pnpm install`
- **Add dependency:** current package `pnpm add <pkg>`; dev `pnpm add -D <pkg>`; workspace root `pnpm add -w <pkg>`
- **Run scripts:** this package `pnpm <script>`; all packages `pnpm -r <script>`; one package `pnpm --filter <pkg-name> <script>`
- **Local packages:** use the `workspace:` protocol in `package.json` (e.g. `"@my-scope/common": "workspace:*"`)

pnpm’s layout is strict (no undeclared deps) and efficient (content-addressable store).

## Layered quality harness

Split so agents and CI get consistent, low-conflict feedback:

- **ESLint** (`eslint.config.mjs`): TypeScript + SonarJS + Vitest tests, **import-x** (resolution and import order), **eslint-plugin-security**, **unicorn/filename-case** (kebab or Pascal filenames). Use `pnpm lint:eslint` or `pnpm format:eslint` for ESLint-only fixes.
- **Prettier:** via Trunk (`pnpm format` / `pnpm lint`). Do not duplicate stylistic rules in ESLint for the same concerns.
- **Knip** (`knip.json`): unused deps, exports, workspace entrypoints. Run `pnpm knip` before large refactors or when adding packages.
- **Trunk:** ESLint, Prettier, **Trivy**, **OSV-scanner**, etc. Use `pnpm lint:security` for security-scoped checks.

**Suggested pre-commit gate:** `pnpm lint:eslint && pnpm knip && pnpm lint && pnpm test` (or `pnpm lint` alone for Trunk-only). Prefer **`pnpm format`** / `trunk fmt`; use **`pnpm format:eslint`** when you want ESLint `--fix` only.

## Code style

- TypeScript for all application code
- Follow ESLint/Prettier as configured (Trunk)
- Functional patterns where they simplify code
- **Naming:** `PascalCase` types/classes, `camelCase` values/functions, **kebab-case** filenames (e.g. `user-service.ts`)

## Testing

- Tests in `tests/` or colocated `*.test.ts`
- **Vitest** for unit and integration tests
- Aim for strong coverage on core logic
- Run `pnpm test` before committing

## Git workflow

- Branch from `main`
- Run `pnpm lint && pnpm test` before commits
- **Commits:** `type(scope): description` (e.g. `feat(ui): add button`)
- **Types:** feat, fix, docs, style, refactor, test, chore
- **Postmortems vs commit type:** Whether to run a session postmortem depends on **how substantive the session was**, not the conventional commit `type:` alone (a `chore:` change can still warrant a postmortem if there was friction). See **Session closure and postmortems** below.

## Session closure and postmortems

Coding agents should **learn from failures and surprises** and turn that into durable improvements (rules, hooks, skills, agents) where it pays off.

**When to run:** At the end of a **non-trivial** session — e.g. debugging, failed tests or CI, security or tooling surprises, design trade-offs, multi-step feature work, or any work where a short written capture would help the next person or agent.

**When to skip:** When the session was **trivial overall** (typo, one-line fix, pure format pass) **unless** something went wrong (unexpected failure, surprise breakage).

**How:** In **Claude Code**, invoke **`/postmortem`** (skill: `.claude/skills/postmortem/`). On other surfaces, open that skill’s `SKILL.md` and follow the same steps in prose or in your handoff before closing.

## Improving agent behavior

When you want durable fixes (not one-off chat advice):

1. **Classify** what to add: **rule** (guidance in **`AGENTS.md`** or **`.cursor/rules/`**), **hook** (mandatory guard in **`.claude/settings.json`**), **skill** (repeatable workflow under **`.claude/skills/`**), or **agent** (Task subagent under **`.claude/agents/`**).
2. **Prefer the narrowest shared surface:** edit **`AGENTS.md`** when every coding agent should follow the change; use **`.cursor/rules/`** for editor-scoped guidance; use **`.claude/`** when the behavior is Claude Code–specific (hooks, slash skills, subagent definitions).
3. **Stay minimal** — only codify patterns that actually recur.
4. In **Claude Code**, use **`/improve-claude-config`** to drive changes under **`.claude/`** (settings, hooks, skills, agents).

## Architecture

- **Packages:** `packages/*` (and `src/` inside a package when used)
- **Root:** shared scripts and config
- **CI:** `.github/workflows/`
- **Agent/tooling config:** `.claude/` (Claude Code), `.cursor/` (Cursor rules), `.codex/` (Codex), `.gemini/` (Gemini CLI). Copilot can also read `.github/copilot-instructions.md` alongside `AGENTS.md`.
- **ADRs:** significant decisions in `docs/adr` when you use ADR tooling

## Common gotchas

- Always use **pnpm**, not npm or yarn
- **Supply chain:** `minimumReleaseAge` is **7 days** (new registry versions are not installed until that age). `blockExoticSubdeps` is **on**. If install fails with ignored build scripts, run **`pnpm approve-builds`** or add the package under **`allowBuilds`** in `pnpm-workspace.yaml`.
- Do not install Trunk-managed linters globally; versions live in `.trunk/trunk.yaml`
- Commit **`pnpm-lock.yaml`**
- After `pnpm install`, Trunk is under `node_modules/.bin`; pin is in `.trunk/trunk.yaml` (`cli.version`). Run `pnpm exec trunk install` if formatters/linters are missing

## Learned User Preferences

- Prefer simple, minimal implementations; explicitly avoid over-engineering when planning and building features.
- Request plans with architecture diagrams before implementing non-trivial changes.
- Use structured problem-solving analysis (`/problem-solving`) before major architectural or design decisions.
- Execute attached plans as specified without editing the plan file itself.
- Do not spawn shell commands from TypeScript application code; pass Google access tokens via environment variables (e.g. from `gcloud auth print-access-token`) instead.
- Application code must be TypeScript; TypeScript packages belong under `packages/`.

## Learned Workspace Facts

- Demo: remote A2A agent chained to MCP servers (BigQuery): separate pnpm workspace packages for web-chat, remote-agent, bq-mcp-server, mcp-auth, and related tooling.
- `bq-mcp` and `remote-agent` run on private Cloud Run; IDE/MCP clients use `scripts/proxy-mcp.sh` (:8080) and `scripts/proxy-agent.sh` (:8081).
- `remote-agent` exposes both A2A (agent-cli, web-chat) and MCP (`/mcp` with a `chat` tool); `bq-mcp` exposes direct BigQuery MCP tools (`list_datasets`, `get_authenticated_user`).
- `web-chat` talks to `remote-agent` via A2A for chat (never directly to `bq-mcp`). Platform-info loads live A2A + agent MCP metadata only; bq-mcp tool list is documented statically (chain: web-chat → remote-agent → bq-mcp).
- Launch web-chat against Cloud Run with `./scripts/run-web-chat.sh` (direct `AGENT_URL` + gcloud ADC for IAM, not `proxy-agent.sh`); OAuth credentials live in `terraform/terraform.tfvars`, not `packages/web-chat/.env.local`.
- web-chat OAuth requires a Desktop or Web application client in `terraform.tfvars` (`web_oauth_client_id`); Terraform’s IAP OAuth client cannot register localhost redirect URIs—use `./scripts/setup-web-oauth.sh`.
- Cursor MCP uses `.cursor/mcp.json` (Claude Code: `.mcp.json`); localhost proxy URLs + PRM discovery; requires a pre-registered Desktop OAuth client via `MCP_GOOGLE_OAUTH_CLIENT_ID` (not `web_oauth_client_id`)—Google has no MCP dynamic client registration. Only web-chat runs a browser OAuth redirect; agent and MCP validate tokens obtained elsewhere.
- A2A SDK 0.3 serves `/.well-known/agent-card.json` with `protocolVersion: '0.3.0'`; `A2AExpressApp` imports from `@a2a-js/sdk/server/express`. `@google/adk` 1.x requires `sqlite3: true` in `pnpm-workspace.yaml` `allowBuilds`. `web-chat` runs Next.js 16 (Turbopack default).
- Cloud Run services deploy via shell scripts (`deploy-mcp.sh`, `deploy-agent.sh`), not Terraform; web-chat runs locally, not on Cloud Run.
- BigQuery dataset listing impersonates a dedicated metadata-reader service account; authenticated-user lookups use the caller's OAuth token directly.
- `allowed_emails` in Terraform grants Cloud Run `run.invoker` IAM only; runtime app auth relies on Google OAuth token validation, not email allowlists.
