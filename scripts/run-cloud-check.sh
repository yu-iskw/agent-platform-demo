#!/usr/bin/env bash
# Smoke-test the Cloud Run remote-agent + MCP stack via agent-cli.
#
# Uses direct *.run.app URL with Cloud Run identity token + Google access token header.
# Requires: gcloud auth login, gcloud auth application-default login, run.invoker on remote-agent.
#
# Usage:
#   ./scripts/run-cloud-check.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

if [[ -f "${ROOT_DIR}/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "${ROOT_DIR}/.env"
	set +a
fi

AGENT_URL="$(gcloud run services describe remote-agent --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"
if [[ -z ${AGENT_URL} ]]; then
	echo "remote-agent is not deployed in ${PROJECT_ID}/${REGION}. Run ./scripts/deploy-cloud.sh first." >&2
	exit 1
fi

export AGENT_URL
log "Agent URL: ${AGENT_URL}"
warn_if_cloud_run_images_stale
log "Running agent-cli smoke tests against Cloud Run..."

cd "${ROOT_DIR}"
log "Smoke 1/2: list_datasets"
"${SCRIPT_DIR}/agent-cli.sh" "List datasets in project ${PROJECT_ID}"
log "Smoke 2/2: credential introspection"
"${SCRIPT_DIR}/agent-cli.sh" "What Google account am I using and what credentials access BigQuery?"
