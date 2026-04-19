output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_service.main.name
}

output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_service.main.status[0].url
}

output "service_location" {
  description = "Region where the service is deployed"
  value       = google_cloud_run_service.main.location
}

output "batch_job_name" {
  description = "Name of the Cloud Run Job (if enabled)"
  value       = var.enable_batch_job ? google_cloud_run_v2_job.batch[0].name : null
}
