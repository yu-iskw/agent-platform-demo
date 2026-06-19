#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

: "${REMOTE_AGENT_SA_EMAIL:?REMOTE_AGENT_SA_EMAIL is required}"
: "${BQ_METADATA_READER_SA_EMAIL:?BQ_METADATA_READER_SA_EMAIL is required (terraform output bq_metadata_reader_sa_email)}"

resolve_allowed_emails >/dev/null

MCP_URL="${MCP_SERVER_URL:-$(gcloud run services describe bq-mcp --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')}"
MCP_SERVER_URL="${MCP_URL%/}/mcp"

IMAGE="${ARTIFACT_REGISTRY_URL}/remote-agent:${IMAGE_TAG}"

log "Building ${IMAGE} (linux/amd64)"
docker build --platform linux/amd64 -f "${ROOT_DIR}/packages/remote-agent/Dockerfile" -t "${IMAGE}" "${ROOT_DIR}"

log "Pushing ${IMAGE}"
docker push "${IMAGE}"

log "Deploying private Cloud Run service remote-agent"
gcloud run deploy remote-agent \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--image="${IMAGE}" \
	--service-account="${REMOTE_AGENT_SA_EMAIL}" \
	--no-allow-unauthenticated \
	--min-instances=1 \
	--max-instances=1 \
	--port=8081 \
	--set-env-vars="MCP_SERVER_URL=${MCP_SERVER_URL},MCP_AUTH_MODE=cloud,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},BQ_METADATA_READER_SA_EMAIL=${BQ_METADATA_READER_SA_EMAIL},GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-us-central1},AGENT_MODEL=${AGENT_MODEL:-gemini-2.5-flash}"

AGENT_URL="$(gcloud run services describe remote-agent --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
MCP_RESOURCE_URL="${AGENT_URL%/}/mcp"

log "Setting PUBLIC_AGENT_URL=${AGENT_URL} and MCP_RESOURCE_URL=${MCP_RESOURCE_URL}"
gcloud run services update remote-agent \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--update-env-vars="PUBLIC_AGENT_URL=${AGENT_URL},MCP_RESOURCE_URL=${MCP_RESOURCE_URL}" \
	--quiet

log "Deployed remote-agent at ${AGENT_URL} (MCP: ${MCP_RESOURCE_URL})"
log "Run ./scripts/run-web-chat.sh for local web-chat (Cloud Run agent, direct URL)"

require_gcloud_user_auth
if ! verify_remote_agent_api_catalog "${AGENT_URL}"; then
	echo "remote-agent deploy finished but API catalog check failed." >&2
	exit 1
fi

grant_run_invoker_to_allowed_users remote-agent
