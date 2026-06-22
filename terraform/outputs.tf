output "project_id" {
  value = var.project_id
}

output "region" {
  value = var.region
}

output "artifact_registry_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}"
}

output "remote_agent_sa_email" {
  value = google_service_account.remote_agent.email
}

output "bq_mcp_sa_email" {
  value = google_service_account.bq_mcp.email
}

output "bq_metadata_reader_sa_email" {
  value = google_service_account.bq_metadata_reader.email
}

output "allowed_emails" {
  description = "Users granted roles/run.invoker by deploy scripts (not passed to Cloud Run containers)"
  value       = local.allowed_emails
}

output "oauth_client_id" {
  description = "OAuth client ID for local web-chat (from terraform.tfvars web_oauth_client_id, else IAP fallback)"
  value       = local.web_oauth_client_id_effective
}

output "oauth_client_secret" {
  description = "OAuth client secret for web-chat when web_oauth_client_type is web; empty for desktop PKCE"
  value       = local.web_oauth_client_secret_effective
  sensitive   = true
}

output "web_oauth_client_type" {
  description = "OAuth client type for web-chat: desktop (PKCE) or web (confidential)"
  value       = var.web_oauth_client_type
}

output "iap_oauth_client_id" {
  description = "Terraform-managed IAP OAuth client ID (does not support web-chat redirect URIs; use web_oauth_client_id instead)"
  value       = local.iap_oauth_client_id
}

output "web_oauth_redirect_uris" {
  description = "Register on the Google OAuth Web application client (web-chat and hosted IDE callbacks)"
  value       = var.web_oauth_redirect_uris
}

output "mcp_oauth_redirect_uris" {
  description = "Register on a separate Google OAuth Desktop application client for IDE MCP flows"
  value       = local.mcp_oauth_redirect_uris
}

output "claude_code_oauth_callback_port" {
  description = "Pinned loopback port for Claude Code MCP; pass to claude mcp add --callback-port"
  value       = var.claude_code_oauth_callback_port
}

output "mcp_oauth_client_id" {
  description = "Desktop OAuth client ID for IDE MCP (manual GCP Console setup; empty until set in tfvars)"
  value       = var.mcp_oauth_client_id
}

output "mcp_oauth_client_secret" {
  description = "Desktop OAuth client secret for IDE MCP (manual GCP Console setup)"
  value       = var.mcp_oauth_client_secret
  sensitive   = true
}

output "oauth_setup_note" {
  description = "How Google SSO applies to each component"
  value       = "Configure web-chat OAuth only in terraform/terraform.tfvars (web_oauth_client_id, web_oauth_client_type, optional web_oauth_client_secret). Run terraform apply then ./scripts/run-web-chat.sh. IAP client cannot register localhost redirect URIs. See scripts/setup-web-oauth.sh."
}

output "mcp_oauth_setup_note" {
  description = "Steps to register IDE MCP OAuth redirect URIs"
  value       = "Create OAuth client ID → Desktop app in GCP Console. Register every URI from mcp_oauth_redirect_uris. Set mcp_oauth_client_id and mcp_oauth_client_secret in terraform.tfvars. For Claude Code, use --callback-port matching claude_code_oauth_callback_port. Codex CLI localhost:1455 is OpenAI sign-in only — do not register it for Google OAuth."
}
