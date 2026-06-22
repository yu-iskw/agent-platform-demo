#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

: "${REMOTE_AGENT_SA_EMAIL:?REMOTE_AGENT_SA_EMAIL is required (terraform output remote_agent_sa_email)}"
: "${BQ_MCP_SA_EMAIL:?BQ_MCP_SA_EMAIL is required (terraform output bq_mcp_sa_email)}"
: "${BQ_METADATA_READER_SA_EMAIL:?BQ_METADATA_READER_SA_EMAIL is required (terraform output bq_metadata_reader_sa_email)}"

resolve_allowed_emails >/dev/null
resolve_delegation_jwt_secret

IMAGE="${ARTIFACT_REGISTRY_URL}/bq-mcp:${IMAGE_TAG}"

log "Building ${IMAGE} (linux/amd64)"
docker build --platform linux/amd64 -f "${ROOT_DIR}/packages/bq-mcp-server/Dockerfile" -t "${IMAGE}" "${ROOT_DIR}"

log "Pushing ${IMAGE}"
docker push "${IMAGE}"

log "Deploying private Cloud Run service bq-mcp"
gcloud run deploy bq-mcp \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--image="${IMAGE}" \
	--service-account="${BQ_MCP_SA_EMAIL}" \
	--no-allow-unauthenticated \
	--min-instances=1 \
	--max-instances=1 \
	--port=8080 \
	--set-env-vars="AUTH_MODE=cloud,EXPECTED_CALLER_SA_EMAIL=${REMOTE_AGENT_SA_EMAIL},BQ_METADATA_READER_SA_EMAIL=${BQ_METADATA_READER_SA_EMAIL},DELEGATION_JWT_SECRET=${DELEGATION_JWT_SECRET}"

log "Granting remote-agent-sa run.invoker on bq-mcp"
gcloud run services add-iam-policy-binding bq-mcp \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--member="serviceAccount:${REMOTE_AGENT_SA_EMAIL}" \
	--role="roles/run.invoker" \
	--quiet

MCP_URL="$(gcloud run services describe bq-mcp --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
MCP_RESOURCE_URL="${MCP_URL%/}/mcp"

log "Setting MCP_RESOURCE_URL=${MCP_RESOURCE_URL}"
gcloud run services update bq-mcp \
	--project="${PROJECT_ID}" \
	--region="${REGION}" \
	--update-env-vars="MCP_RESOURCE_URL=${MCP_RESOURCE_URL}" \
	--quiet

grant_run_invoker_to_allowed_users bq-mcp

log "MCP service URL (for remote-agent MCP_SERVER_URL): ${MCP_RESOURCE_URL}"
