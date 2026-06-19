#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

SERVICE_URL="$(gcloud run services describe remote-agent \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--format='value(status.url)')"

log "Proxying private remote-agent (${SERVICE_URL}) to http://127.0.0.1:8081"
exec node "${SCRIPT_DIR}/cloud-run-local-proxy.mjs" \
	--target="${SERVICE_URL}" \
	--port=8081 \
	--bind=127.0.0.1
