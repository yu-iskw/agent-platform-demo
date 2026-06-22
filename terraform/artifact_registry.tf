resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  description   = "Container images for agent-platform-demo (bq-mcp, remote-agent)"
  format        = "DOCKER"
  project       = var.project_id

  depends_on = [google_project_service.required_apis]
}
