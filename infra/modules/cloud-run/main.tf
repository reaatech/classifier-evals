# Cloud Run module for classifier-evals
# Deploys the classifier-evals service to Google Cloud Run

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "classifier-evals"
}

variable "image_url" {
  description = "Container image URL (e.g., gcr.io/project/classifier-evals:latest)"
  type        = string
}

variable "memory" {
  description = "Memory allocation (e.g., 512Mi, 1Gi, 2Gi)"
  type        = string
  default     = "1Gi"
}

variable "cpu" {
  description = "CPU allocation (1 or 2)"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "min_instances" {
  description = "Minimum number of instances (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "timeout" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "environment_variables" {
  description = "Environment variables to set on the service"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets to mount (map of env var name to secret name)"
  type        = map(string)
  default     = {}
}

variable "ingress_settings" {
  description = "Ingress settings (allow-all, allow-internal-only, allow-internal-and-gclb)"
  type        = string
  default     = "allow-all"
}

variable "iam_members" {
  description = "List of IAM members to grant invoker role"
  type        = list(string)
  default     = []
}

locals {
  env_vars = merge(
    {
      NODE_ENV = "production"
    },
    var.environment_variables
  )
}

# Cloud Run service
resource "google_cloud_run_service" "default" {
  name     = var.service_name
  location = var.region
  project  = var.project_id

  template {
    spec {
      container_concurrency = 80
      timeout_seconds       = var.timeout

      containers {
        image = var.image_url

        resources {
          limits = {
            cpu    = tostring(var.cpu)
            memory = var.memory
          }
        }

        dynamic "env" {
          for_each = local.env_vars
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = var.secrets
          content {
            name = env.key
            value_source {
              secret_key_ref {
                name = env.value
                key  = "latest"
              }
            }
          }
        }
      }
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxInstances" = tostring(var.max_instances)
        "autoscaling.knative.dev/minInstances" = tostring(var.min_instances)
        "run.googleapis.com/cloudsql-instances" = "" # Add if using Cloud SQL
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  lifecycle {
    ignore_changes = [
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].spec[0].containers[0].image,
    ]
  }
}

# IAM binding for Cloud Run invoker
resource "google_cloud_run_service_iam_member" "invoker" {
  for_each = toset(var.iam_members)

  project  = var.project_id
  location = google_cloud_run_service.default.location
  service  = google_cloud_run_service.default.name
  role     = "roles/run.invoker"
  member   = each.value
}

# Output the service URL
output "service_url" {
  description = "URL of the Cloud Run service"
  value       = google_cloud_run_service.default.status[0].url
}

output "service_name" {
  description = "Name of the Cloud Run service"
  value       = google_cloud_run_service.default.name
}
