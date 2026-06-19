#!/usr/bin/env bash
# One-time setup: create a Google OAuth client for local web-chat.
#
# Do NOT use the Terraform IAP client (read-only in Console, no redirect URIs).
#
# Usage:
#   ./scripts/setup-web-oauth.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

require_command terraform

CREDENTIALS_URL="https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}"
CREATE_URL="https://console.cloud.google.com/apis/credentials/oauthclient/create?project=${PROJECT_ID}"

iap_id="$(resolve_iap_oauth_client_id || true)"

log "web-chat OAuth setup (${PROJECT_ID})"
echo ""
echo "You are likely viewing the wrong OAuth client if Console says:"
echo '  "This automatically generated OAuth client ID is required for your project.'
echo '   It can'\''t be modified."'
echo ""
echo "That is the Terraform **IAP** client (read-only). It cannot register localhost"
echo "redirect URIs and does not expose a manageable secret in Console."
if [[ -n ${iap_id} ]]; then
	echo "  IAP client ID: ${iap_id}"
fi
echo ""
echo "Create a **new** client instead (+ CREATE CREDENTIALS → OAuth client ID):"
echo "  ${CREATE_URL}"
echo "  Credentials list: ${CREDENTIALS_URL}"
echo ""
echo "Register every Authorized redirect URI:"
resolve_web_oauth_redirect_uris | while IFS= read -r uri; do
	[[ -n ${uri} ]] && echo "  ${uri}"
done
echo ""
echo "── Option A (recommended for web-chat): Web application ──"
echo "  Google’s token endpoint requires client_secret for most web-chat flows."
echo "  Next.js runs server-side, so the secret stays off the browser."
echo "  1. + CREATE CREDENTIALS → OAuth client ID → Application type: Web application"
echo "  2. Name: web-chat-local-dev"
echo "  3. Add every redirect URI listed above"
echo "  4. Click Create — Google shows the secret **once**. Copy both ID and secret."
echo "     (If you miss it: open the client → Reset secret.)"
echo ""
echo "  terraform/terraform.tfvars:"
echo '    web_oauth_client_id     = "YOUR_NEW_CLIENT_ID.apps.googleusercontent.com"'
echo '    web_oauth_client_type   = "web"'
echo '    web_oauth_client_secret = "YOUR_NEW_CLIENT_SECRET"'
echo ""
echo "── Option B: Desktop application (PKCE-only; often fails token exchange) ──"
echo "  Google frequently returns 400 client_secret is missing even with PKCE."
echo "  Use only if token exchange succeeds without a secret in your project."
echo "  1. + CREATE CREDENTIALS → OAuth client ID → Application type: Desktop app"
echo "  2. Add redirect URIs above"
echo "  3. Copy the Client ID"
echo ""
echo "  terraform/terraform.tfvars:"
echo '    web_oauth_client_id   = "YOUR_NEW_CLIENT_ID.apps.googleusercontent.com"'
echo '    web_oauth_client_type = "desktop"'
echo ""
echo "Then:"
echo "  terraform -chdir=terraform apply"
echo "  ./scripts/run-web-chat.sh --sync-env"
echo ""

current_id="$(terraform_output_raw oauth_client_id || true)"
if [[ -n ${iap_id} ]] && [[ ${current_id} == "${iap_id}" ]]; then
	log "terraform still points at the IAP client — create a new client (steps above)."
elif [[ -n ${current_id} ]]; then
	log "Configured client: ${current_id%%.*}…"
fi

if command -v open >/dev/null 2>&1 && [[ -t 0 ]]; then
	read -r -p "Open Credentials list (not the IAP client)? [y/N] " reply
	if [[ ${reply} =~ ^[Yy]$ ]]; then
		open "${CREDENTIALS_URL}"
	fi
fi
