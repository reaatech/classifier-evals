output "service_url" {
  description = "URL of the Cloud Run service"
  value       = module.gcp_cloud_run.service_url
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = module.gcp_cloud_run.service_name
}

output "service_location" {
  description = "Location of the Cloud Run service"
  value       = module.gcp_cloud_run.service_location
}

output "job_name" {
  description = "Name of the Cloud Run Job for batch workloads"
  value       = module.gcp_cloud_run.job_name
}

output "service_account_email" {
  description = "Email of the service account"
  value       = google_service_account.app.email
}
