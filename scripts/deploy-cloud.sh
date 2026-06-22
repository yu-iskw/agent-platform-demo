#!/usr/bin/env bash
# Apply Terraform foundation, build/push images, and deploy private Cloud Run services.
#
# Requires terraform.tfvars allowed_emails (used for run.invoker grants by deploy scripts).
#
# Usage:
#   ./scripts/deploy-cloud.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

log "Applying Terraform (project=${PROJECT_ID}, region=${REGION})"
terraform -chdir="${TERRAFORM_DIR}" apply -auto-approve

REMOTE_AGENT_SA_EMAIL="$(terraform -chdir="${TERRAFORM_DIR}" output -raw remote_agent_sa_email)"
export REMOTE_AGENT_SA_EMAIL
BQ_MCP_SA_EMAIL="$(terraform -chdir="${TERRAFORM_DIR}" output -raw bq_mcp_sa_email)"
export BQ_MCP_SA_EMAIL
BQ_METADATA_READER_SA_EMAIL="$(terraform -chdir="${TERRAFORM_DIR}" output -raw bq_metadata_reader_sa_email)"
export BQ_METADATA_READER_SA_EMAIL
ARTIFACT_REGISTRY_URL="$(terraform -chdir="${TERRAFORM_DIR}" output -raw artifact_registry_url)"
export ARTIFACT_REGISTRY_URL

log "Configuring Docker for Artifact Registry"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

"${SCRIPT_DIR}/deploy-mcp.sh"
"${SCRIPT_DIR}/deploy-agent.sh"

AGENT_URL="$(gcloud run services describe remote-agent --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)')"
log ""
log "Cloud Run deploy complete."
log "  Agent URL: ${AGENT_URL}"
log "  CLI (direct): export AGENT_URL=${AGENT_URL} && ./scripts/agent-cli.sh \"List datasets in ${PROJECT_ID}\""
log "  CLI (proxy):  ./scripts/proxy-agent.sh  # then AGENT_URL=http://127.0.0.1:8081"
log "  IDE MCP:      ./scripts/proxy-mcp.sh   # then point MCP client at http://127.0.0.1:8080/mcp"
