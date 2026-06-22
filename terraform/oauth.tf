# OAuth client for local web-chat via IAP brand/client.
# Requires org-level permissions; if apply fails, create the client manually and set oauth_client_id in tfvars.
#
# If brand creation fails with 409 (already exists), import the existing brand:
#   gcloud iap oauth-brands list --project=PROJECT_ID --format='value(name)'
#   terraform import -var-file=terraform.tfvars 'google_iap_brand.project_brand[0]' 'projects/NUM/brands/NUM'

resource "google_iap_brand" "project_brand" {
  count             = var.iap_support_email != "" ? 1 : 0
  project           = var.project_id
  support_email     = var.iap_support_email
  application_title = var.iap_application_title

  depends_on = [google_project_service.required_apis]

  # One IAP brand per project; import existing brand if apply returns 409.
  lifecycle {
    ignore_changes = [
      application_title,
      support_email,
      project,
    ]
  }
}

resource "google_iap_client" "web_chat" {
  count        = var.iap_support_email != "" ? 1 : 0
  display_name = var.oauth_client_display_name
  brand        = google_iap_brand.project_brand[0].name
}
