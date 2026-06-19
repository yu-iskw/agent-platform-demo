#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export TERRAFORM_DIR="${ROOT_DIR}/terraform"

export PROJECT_ID="${PROJECT_ID:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw project_id 2>/dev/null | grep -v '^╷' | grep -v '^│' | grep -v '^╵' | tail -1 || echo ubie-yu-sandbox)}"
export REGION="${REGION:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw region 2>/dev/null | grep -v '^╷' | grep -v '^│' | grep -v '^╵' | tail -1 || echo asia-northeast1)}"
export ARTIFACT_REGISTRY_URL="${ARTIFACT_REGISTRY_URL:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw artifact_registry_url 2>/dev/null || echo "${REGION}-docker.pkg.dev/${PROJECT_ID}/agent-platform-demo")}"
export REMOTE_AGENT_SA_EMAIL="${REMOTE_AGENT_SA_EMAIL:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw remote_agent_sa_email 2>/dev/null || true)}"
export BQ_MCP_SA_EMAIL="${BQ_MCP_SA_EMAIL:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw bq_mcp_sa_email 2>/dev/null || true)}"
export BQ_METADATA_READER_SA_EMAIL="${BQ_METADATA_READER_SA_EMAIL:-$(terraform -chdir="${TERRAFORM_DIR}" output -raw bq_metadata_reader_sa_email 2>/dev/null || true)}"
export IMAGE_TAG="${IMAGE_TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

log() {
	printf '[a2a-mcp-demo] %s\n' "$*"
}

terraform_output_raw() {
	local name=$1
	terraform -chdir="${TERRAFORM_DIR}" output -raw "${name}" 2>/dev/null | grep -v '^╷' | grep -v '^│' | grep -v '^╵' | tail -1 || true
}

require_command() {
	local name=$1
	if ! command -v "${name}" >/dev/null 2>&1; then
		echo "${name} is required but not found on PATH." >&2
		exit 1
	fi
}

require_gcloud_user_auth() {
	local account
	account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)"
	if [[ -z ${account} ]]; then
		echo "No active gcloud account. Run: gcloud auth login" >&2
		exit 1
	fi
}

require_gcloud_adc() {
	if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
		echo "Application Default Credentials are required for Cloud Run IAM tokens. Run: gcloud auth application-default login" >&2
		exit 1
	fi
}

require_port_available() {
	local port=$1
	local pid cmd

	pid="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
	if [[ -z ${pid} ]]; then
		return 0
	fi

	cmd="$(ps -p "${pid}" -o comm= 2>/dev/null | xargs || echo unknown)"
	echo "Port ${port} is already in use by ${cmd} (PID ${pid})." >&2
	echo "Stop the existing server, then retry:" >&2
	echo "  kill ${pid}" >&2
	echo "Or rerun with --force to stop a stale next dev server on this port." >&2
	exit 1
}

is_stale_web_chat_dev_server() {
	local pid=$1
	local args
	args="$(ps -p "${pid}" -o args= 2>/dev/null || true)"
	[[ ${args} == *"next dev"* ]] || [[ ${args} == *"next-server"* ]]
}

prepare_web_chat_dev_port() {
	local port=$1
	local force=$2
	local next_dir=$3

	WEB_CHAT_REPLACED_DEV=false
	ensure_web_chat_port "${port}" "${force}"
	if [[ ${force} == true ]] || [[ ${WEB_CHAT_REPLACED_DEV} == true ]]; then
		clear_web_chat_next_cache "${next_dir}"
	fi
}

ensure_web_chat_port() {
	local port=$1
	local force=${2:-false}
	local pid

	pid="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
	if [[ -z ${pid} ]]; then
		return 0
	fi

	if [[ ${force} == true ]] || is_stale_web_chat_dev_server "${pid}"; then
		WEB_CHAT_REPLACED_DEV=true
		log "Stopping stale web-chat dev server on port ${port} (PID ${pid})"
		kill "${pid}" 2>/dev/null || true
		for _ in 1 2 3 4 5; do
			sleep 0.5
			pid="$(lsof -nP -iTCP:"${port}" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
			[[ -z ${pid} ]] && return 0
		done
		kill -9 "${pid}" 2>/dev/null || true
		sleep 0.5
		return 0
	fi

	require_port_available "${port}"
}

clear_web_chat_next_cache() {
	local next_dir=$1
	if [[ -d ${next_dir} ]]; then
		log "Clearing stale Next.js cache (${next_dir})"
		rm -rf "${next_dir}"
	fi
}

resolve_web_oauth_client_id() {
	local value
	value="$(terraform_output_raw oauth_client_id)"
	if [[ -z ${value} ]]; then
		echo "oauth_client_id is empty. Set web_oauth_client_id in terraform/terraform.tfvars and run terraform apply." >&2
		echo "See ./scripts/setup-web-oauth.sh" >&2
		return 1
	fi
	printf '%s' "${value}"
}

resolve_web_oauth_client_secret() {
	terraform_output_raw oauth_client_secret
}

resolve_web_oauth_client_type() {
	local value
	value="$(terraform_output_raw web_oauth_client_type)"
	printf '%s' "${value:-desktop}"
}

load_web_oauth_from_terraform() {
	GOOGLE_OAUTH_CLIENT_ID="$(resolve_web_oauth_client_id)"
	GOOGLE_OAUTH_CLIENT_SECRET="$(resolve_web_oauth_client_secret)"
	WEB_OAUTH_CLIENT_TYPE="$(resolve_web_oauth_client_type)"
	export GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET WEB_OAUTH_CLIENT_TYPE
}

validate_web_oauth_config() {
	load_web_oauth_from_terraform

	require_web_oauth_client_not_iap "${GOOGLE_OAUTH_CLIENT_ID}"

	case "${WEB_OAUTH_CLIENT_TYPE}" in
	desktop)
		if [[ -n ${GOOGLE_OAUTH_CLIENT_SECRET} ]]; then
			log "WARNING: web_oauth_client_type=desktop but oauth_client_secret is set; ignoring secret (PKCE-only)"
			GOOGLE_OAUTH_CLIENT_SECRET=""
			export GOOGLE_OAUTH_CLIENT_SECRET
		fi
		log "NOTE: If sign-in fails with token exchange 400 / client_secret is missing,"
		log "      use Web application client + web_oauth_client_type=web in terraform.tfvars."
		log "      See ./scripts/setup-web-oauth.sh"
		;;
	web)
		if [[ -z ${GOOGLE_OAUTH_CLIENT_SECRET} ]]; then
			echo "web_oauth_client_type=web requires web_oauth_client_secret in terraform/terraform.tfvars." >&2
			exit 1
		fi
		;;
	*)
		echo "Invalid web_oauth_client_type: ${WEB_OAUTH_CLIENT_TYPE} (expected desktop or web)" >&2
		exit 1
		;;
	esac
}

resolve_iap_oauth_client_id() {
	local from_tf
	from_tf="$(terraform_output_raw iap_oauth_client_id)"
	if [[ -n ${from_tf} ]]; then
		printf '%s' "${from_tf}"
		return 0
	fi

	local brand name client_id
	brand="$(gcloud iap oauth-brands list --project="${PROJECT_ID}" --format='value(name)' 2>/dev/null | head -1 || true)"
	[[ -n ${brand} ]] || return 0

	while IFS= read -r name; do
		[[ -n ${name} ]] || continue
		client_id="${name##*/identityAwareProxyClients/}"
		if [[ ${client_id} == *".apps.googleusercontent.com" ]]; then
			printf '%s' "${client_id}"
			return 0
		fi
	done < <(gcloud iap oauth-clients list "${brand}" --project="${PROJECT_ID}" --format='value(name)' 2>/dev/null || true)
}

resolve_web_oauth_redirect_uris() {
	terraform -chdir="${TERRAFORM_DIR}" output -json web_oauth_redirect_uris 2>/dev/null |
		tr ',' '\n' |
		grep -Eo 'https?://[^"]+' || true
}

is_iap_oauth_client_for_web_chat() {
	local client_id=$1
	local iap_id
	iap_id="$(resolve_iap_oauth_client_id)"
	[[ -n ${iap_id} && ${client_id} == "${iap_id}" ]]
}

require_web_oauth_client_not_iap() {
	local client_id=$1
	if is_iap_oauth_client_for_web_chat "${client_id}"; then
		echo "web-chat cannot use the Terraform IAP OAuth client (redirect_uri_mismatch)." >&2
		echo "Create a Web application OAuth client and register redirect URIs:" >&2
		resolve_web_oauth_redirect_uris | while IFS= read -r uri; do
			[[ -n ${uri} ]] && echo "  ${uri}" >&2
		done
		echo "Run: ./scripts/setup-web-oauth.sh" >&2
		exit 1
	fi
}

# Read KEY=value from a dotenv file (no export, no eval). Sets the named shell variable.
read_env_file_var() {
	local file=$1
	local key=$2
	local var_name=$3
	local line value

	[[ -f ${file} ]] || return 1

	while IFS= read -r line || [[ -n ${line} ]]; do
		[[ ${line} =~ ^[[:space:]]*# ]] && continue
		[[ ${line} =~ ^[[:space:]]*$ ]] && continue
		if [[ ${line} =~ ^[[:space:]]*${key}[[:space:]]*= ]]; then
			value="${line#*=}"
			value="${value#"${value%%[![:space:]]*}"}"
			value="${value%"${value##*[![:space:]]}"}"
			value="${value#\"}"
			value="${value%\"}"
			value="${value#\'}"
			value="${value%\'}"
			printf -v "${var_name}" '%s' "${value}"
			return 0
		fi
	done <"${file}"
	return 1
}

looks_like_placeholder_agent_url() {
	local url=$1
	[[ ${url} == *"…"* ]] || [[ ${url} == *"...."* ]] || [[ ${url} == *"..."* ]]
}

resolve_remote_agent_url() {
	gcloud run services describe remote-agent \
		--project="${PROJECT_ID}" \
		--region="${REGION}" \
		--format='value(status.url)' 2>/dev/null || true
}

cloud_run_image_tag() {
	local service=$1
	local image
	image="$(gcloud run services describe "${service}" \
		--project="${PROJECT_ID}" \
		--region="${REGION}" \
		--format='value(spec.template.spec.containers[0].image)' 2>/dev/null || true)"
	[[ -n ${image} ]] || return 0
	printf '%s' "${image##*:}"
}

warn_if_cloud_run_images_stale() {
	local expected_tag="${IMAGE_TAG}"
	local agent_tag mcp_tag
	agent_tag="$(cloud_run_image_tag remote-agent)"
	mcp_tag="$(cloud_run_image_tag bq-mcp)"
	if [[ -z ${agent_tag} ]] || [[ -z ${mcp_tag} ]]; then
		return 0
	fi
	if [[ ${agent_tag} == "${expected_tag}" ]] && [[ ${mcp_tag} == "${expected_tag}" ]]; then
		return 0
	fi
	log "WARNING: Cloud Run images do not match git HEAD (${expected_tag})"
	log "  remote-agent image tag: ${agent_tag}"
	log "  bq-mcp image tag:       ${mcp_tag}"
	log "  Redeploy: ./scripts/deploy-mcp.sh && ./scripts/deploy-agent.sh"
}

# Comma-separated emails for run.invoker grants. ALLOWED_EMAILS env overrides terraform output.
resolve_allowed_emails() {
	if [[ -n ${ALLOWED_EMAILS-} ]]; then
		printf '%s' "${ALLOWED_EMAILS}"
		return 0
	fi

	local json
	json="$(terraform -chdir="${TERRAFORM_DIR}" output -json allowed_emails 2>/dev/null || true)"
	if [[ -z ${json} ]] || [[ ${json} == "[]" ]]; then
		echo "allowed_emails is empty. Set terraform.tfvars allowed_emails or export ALLOWED_EMAILS." >&2
		return 1
	fi

	local emails
	emails="$(printf '%s' "${json}" | tr -d '[]" \n' | tr ',' '\n' | sed '/^$/d' | paste -sd, -)"
	if [[ -z ${emails} ]]; then
		echo "allowed_emails is empty. Set terraform.tfvars allowed_emails or export ALLOWED_EMAILS." >&2
		return 1
	fi
	printf '%s' "${emails}"
}

grant_run_invoker_to_allowed_users() {
	local service="$1"
	local allowed_emails
	allowed_emails="$(resolve_allowed_emails)"
	IFS=',' read -r -a emails <<<"${allowed_emails}"
	for email in "${emails[@]}"; do
		local trimmed
		trimmed="$(echo "${email}" | xargs)"
		[[ -z ${trimmed} ]] && continue
		log "Granting run.invoker on ${service} to user:${trimmed}"
		gcloud run services add-iam-policy-binding "${service}" \
			--project="${PROJECT_ID}" \
			--region="${REGION}" \
			--member="user:${trimmed}" \
			--role="roles/run.invoker" \
			--quiet
	done
}
