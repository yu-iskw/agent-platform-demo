resource "google_service_account" "remote_agent" {
  account_id   = "remote-agent-sa"
  display_name = "Remote agent Cloud Run runtime"
  project      = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_service_account" "bq_mcp" {
  account_id   = "bq-mcp-sa"
  display_name = "BigQuery MCP server Cloud Run runtime"
  project      = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_project_iam_member" "remote_agent_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.remote_agent.email}"
}

resource "google_service_account" "bq_metadata_reader" {
  account_id   = "bq-metadata-reader"
  display_name = "BigQuery metadata reader (impersonation target)"
  project      = var.project_id

  depends_on = [google_project_service.required_apis]
}

resource "google_project_iam_member" "bq_metadata_reader" {
  project = var.project_id
  role    = "roles/bigquery.metadataViewer"
  member  = "serviceAccount:${google_service_account.bq_metadata_reader.email}"
}

resource "google_service_account_iam_member" "bq_metadata_reader_token_creator" {
  for_each = local.bq_impersonation_principals

  service_account_id = google_service_account.bq_metadata_reader.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = each.value
}
