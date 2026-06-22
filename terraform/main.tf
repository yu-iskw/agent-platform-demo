locals {
  allowed_emails = var.allowed_emails

  bq_impersonation_principals = toset(concat(
    var.bq_impersonation_principals,
    ["serviceAccount:${google_service_account.bq_mcp.email}"],
  ))

  default_mcp_oauth_redirect_uris = [
    "cursor://anysphere.cursor-mcp/oauth/callback",
    "http://localhost:${var.claude_code_oauth_callback_port}/callback",
    "http://127.0.0.1:${var.claude_code_oauth_callback_port}/callback",
    "codex://connector/oauth_callback",
  ]

  mcp_oauth_redirect_uris = coalesce(var.mcp_oauth_redirect_uris, local.default_mcp_oauth_redirect_uris)

  iap_oauth_client_id     = length(google_iap_client.web_chat) > 0 ? google_iap_client.web_chat[0].client_id : ""
  iap_oauth_client_secret = length(google_iap_client.web_chat) > 0 ? google_iap_client.web_chat[0].secret : ""

  # Web-chat OAuth: custom Console client from tfvars, or IAP fallback (IAP cannot serve localhost redirects).
  web_oauth_client_id_effective = var.web_oauth_client_id != "" ? var.web_oauth_client_id : local.iap_oauth_client_id

  web_oauth_uses_custom_client = var.web_oauth_client_id != "" && var.web_oauth_client_id != local.iap_oauth_client_id

  web_oauth_client_secret_effective = (
    var.web_oauth_client_type == "desktop" ? "" :
    var.web_oauth_client_secret != "" ? var.web_oauth_client_secret :
    local.web_oauth_uses_custom_client ? "" :
    local.iap_oauth_client_secret
  )
}

resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "iamcredentials.googleapis.com",
    "aiplatform.googleapis.com",
    "iap.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
