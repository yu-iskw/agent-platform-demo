#!/usr/bin/env bash
# Start bq-mcp-server and remote-agent locally with Google SSO (AUTH_MODE=google).
# Uses gcloud Application Default Credentials for Vertex AI on the host.
#
# Prerequisites:
#   gcloud auth login
#   gcloud auth application-default login
#   cp .env.example .env  # optional: BQ_METADATA_READER_SA_EMAIL from terraform output
#
# Usage:
#   ./scripts/run-local-dev.sh          # start both services (foreground, Ctrl+C stops)
#   ./scripts/run-local-dev.sh --check # only verify health + CLI smoke test

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

if [[ -f "${ROOT_DIR}/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "${ROOT_DIR}/.env"
	set +a
fi

export AUTH_MODE="${AUTH_MODE:-google}"
export MCP_AUTH_MODE="${MCP_AUTH_MODE:-google}"
export MCP_SERVER_URL="${MCP_SERVER_URL:-http://127.0.0.1:8080/mcp}"
export AGENT_URL="${AGENT_URL:-http://127.0.0.1:8081}"
export MCP_RESOURCE_URL="${MCP_RESOURCE_URL:-http://127.0.0.1:8081/mcp}"
export PUBLIC_AGENT_URL="${PUBLIC_AGENT_URL:-http://127.0.0.1:8081}"
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-ubie-yu-sandbox}"
export GOOGLE_GENAI_USE_VERTEXAI="${GOOGLE_GENAI_USE_VERTEXAI:-true}"
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
export AGENT_MODEL="${AGENT_MODEL:-gemini-2.5-flash}"
export NODE_ENV="${NODE_ENV:-development}"
export BQ_METADATA_READER_SA_EMAIL="${BQ_METADATA_READER_SA_EMAIL-}"

if [[ -z ${BQ_METADATA_READER_SA_EMAIL} ]]; then
	echo "BQ_METADATA_READER_SA_EMAIL is required (terraform output bq_metadata_reader_sa_email or .env)." >&2
	exit 1
fi

wait_for_health() {
	local url=$1
	local name=$2
	local attempts=30
	for ((i = 1; i <= attempts; i++)); do
		if curl -sf "${url}" >/dev/null 2>&1; then
			echo "${name} is healthy at ${url}"
			return 0
		fi
		sleep 1
	done
	echo "${name} did not become healthy at ${url}" >&2
	return 1
}

run_cli_smoke() {
	echo "Running agent-cli smoke test..."
	cd "${ROOT_DIR}"
	"${SCRIPT_DIR}/agent-cli.sh" "List datasets in project ${GOOGLE_CLOUD_PROJECT}"
}

if [[ ${1-} == "--check" ]]; then
	wait_for_health "http://127.0.0.1:8080/healthz" "bq-mcp-server"
	wait_for_health "http://127.0.0.1:8081/healthz" "remote-agent"
	run_cli_smoke
	exit 0
fi

cd "${ROOT_DIR}"
pnpm build

MCP_PID=""
AGENT_PID=""
cleanup() {
	if [[ -n ${MCP_PID} ]]; then
		kill "${MCP_PID}" 2>/dev/null || true
	fi
	if [[ -n ${AGENT_PID} ]]; then
		kill "${AGENT_PID}" 2>/dev/null || true
	fi
}
trap cleanup EXIT INT TERM

echo "Starting bq-mcp-server (AUTH_MODE=${AUTH_MODE})..."
MCP_RESOURCE_URL=http://127.0.0.1:8080/mcp pnpm --filter @agent-platform/bq-mcp-server dev &
MCP_PID=$!

echo "Starting remote-agent (MCP_AUTH_MODE=${MCP_AUTH_MODE}, MCP_RESOURCE_URL=${MCP_RESOURCE_URL})..."
pnpm --filter @agent-platform/remote-agent dev &
AGENT_PID=$!

wait_for_health "http://127.0.0.1:8080/healthz" "bq-mcp-server"
wait_for_health "http://127.0.0.1:8081/healthz" "remote-agent"

echo ""
echo "Local stack ready:"
echo "  bq-mcp MCP:       http://127.0.0.1:8080/mcp"
echo "  remote-agent MCP: http://127.0.0.1:8081/mcp"
echo "  Agent (A2A):      http://127.0.0.1:8081"
echo ""
echo "CLI example:"
echo "  ./scripts/agent-cli.sh \"List datasets in ${GOOGLE_CLOUD_PROJECT}\""
echo ""
echo "Press Ctrl+C to stop."

wait
