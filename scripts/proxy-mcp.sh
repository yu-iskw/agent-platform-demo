#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

SERVICE_URL="$(gcloud run services describe bq-mcp \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--format='value(status.url)')"

log "Proxying private bq-mcp (${SERVICE_URL}) to http://127.0.0.1:8080 (debug only)"
exec node "${SCRIPT_DIR}/cloud-run-local-proxy.mjs" \
	--target="${SERVICE_URL}" \
	--port=8080 \
	--bind=127.0.0.1
