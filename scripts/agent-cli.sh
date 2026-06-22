#!/usr/bin/env bash
# Run agent-cli with a short-lived Google user access token.
#
# Sets GOOGLE_ACCESS_TOKEN from gcloud when not already exported.
# Replaces documentation placeholder AGENT_URL values with the live Cloud Run URL.
#
# Prerequisites: gcloud auth login (and application-default login for Vertex locally).
#
# Usage:
#   ./scripts/agent-cli.sh "List datasets in project ${PROJECT_ID}"
#   export AGENT_URL=http://127.0.0.1:8081
#   ./scripts/agent-cli.sh "List datasets in project ${PROJECT_ID}"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

if [[ -z ${GOOGLE_ACCESS_TOKEN-} ]]; then
	if ! command -v gcloud >/dev/null 2>&1; then
		echo "gcloud is required to obtain GOOGLE_ACCESS_TOKEN, or export GOOGLE_ACCESS_TOKEN yourself." >&2
		exit 1
	fi
	GOOGLE_ACCESS_TOKEN="$(gcloud auth print-access-token)" || {
		echo "Could not obtain access token. Run: gcloud auth login" >&2
		exit 1
	}
	export GOOGLE_ACCESS_TOKEN
fi

if [[ -n ${AGENT_URL-} ]] && looks_like_placeholder_agent_url "${AGENT_URL}"; then
	log "AGENT_URL looks like a documentation placeholder; resolving remote-agent from Cloud Run..."
	log "Tip: run 'unset AGENT_URL' so future sessions do not reuse the placeholder."
	AGENT_URL="$(resolve_remote_agent_url)"
	if [[ -z ${AGENT_URL} ]]; then
		echo "Could not resolve remote-agent URL. Run ./scripts/deploy-agent.sh first." >&2
		exit 1
	fi
	export AGENT_URL
	log "Using AGENT_URL=${AGENT_URL}"
fi

cd "${ROOT_DIR}"
exec pnpm --filter @agent-platform/agent-cli start -- "$@"
