variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "Default region for Artifact Registry and Cloud Run deploy scripts"
}

variable "allowed_emails" {
  type        = list(string)
  description = "Users granted roles/run.invoker by deploy scripts; not passed to Cloud Run containers"
  default     = []
}

variable "iap_support_email" {
  type        = string
  description = "Support email for IAP OAuth brand (must be a project owner or org admin)"
}

variable "iap_application_title" {
  type        = string
  description = "Application title shown on OAuth consent screen"
  default     = "Demo: Chain of Remote A2A Agent and MCP Servers"
}

variable "oauth_client_display_name" {
  type        = string
  description = "Display name for the OAuth client used by local web-chat"
  default     = "web-chat-local"
}

variable "web_oauth_client_id" {
  type        = string
  description = "Web application OAuth client ID for web-chat (create manually in GCP Console; overrides IAP client)"
  default     = ""
}

variable "web_oauth_client_secret" {
  type        = string
  description = "OAuth client secret for web-chat when web_oauth_client_type is web; leave empty for desktop (PKCE)"
  default     = ""
  sensitive   = true
}

variable "web_oauth_client_type" {
  type        = string
  description = "OAuth client type for web-chat: desktop (PKCE, no secret) or web (requires web_oauth_client_secret)"
  default     = "desktop"

  validation {
    condition     = contains(["desktop", "web"], var.web_oauth_client_type)
    error_message = "web_oauth_client_type must be desktop or web."
  }
}

variable "web_oauth_redirect_uris" {
  type        = list(string)
  description = "OAuth redirect URIs for the Web application client (web-chat plus hosted IDE callbacks such as Claude Desktop)"
  default = [
    "http://localhost:3000/api/auth/callback",
    "http://127.0.0.1:3000/api/auth/callback",
    "https://claude.ai/api/mcp/auth_callback",
    "https://claude.com/api/mcp/auth_callback",
    "https://www.cursor.com/agents/mcp/oauth/callback",
  ]
}

variable "claude_code_oauth_callback_port" {
  type        = number
  description = "Pinned loopback port for Claude Code MCP OAuth (--callback-port); must match registered Desktop client URIs"
  default     = 54321
}

variable "mcp_oauth_redirect_uris" {
  type        = list(string)
  description = "Redirect URIs for IDE MCP OAuth on a separate Google OAuth Desktop application client; null uses defaults derived from claude_code_oauth_callback_port"
  default     = null
  nullable    = true
}

variable "mcp_oauth_client_id" {
  type        = string
  description = "Optional Desktop OAuth client ID (created manually in GCP Console; not managed by Terraform)"
  default     = ""
}

variable "mcp_oauth_client_secret" {
  type        = string
  description = "Optional Desktop OAuth client secret (created manually in GCP Console; not managed by Terraform)"
  default     = ""
  sensitive   = true
}

variable "artifact_registry_repository_id" {
  type        = string
  description = "Artifact Registry repository ID for container images"
  default     = "agent-platform-demo"
}

variable "bq_impersonation_principals" {
  type        = list(string)
  description = "IAM members who may impersonate bq-metadata-reader (user:, serviceAccount:, group:). bq-mcp-sa is granted automatically."
  default     = []
}
