# Google Cloud Run Module for classifier-evals

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.0"
    }
  }
}

# Cloud Run Service
resource "google_cloud_run_service" "main" {
  name     = "${var.project_name}-${var.environment}"
  location = var.region

  template {
    spec {
      containers {
        image = var.docker_image_url

        dynamic "env" {
          for_each = var.environment_variables
          content {
            name  = env.key
            value = env.value
          }
        }

        resources {
          limits = {
            cpu    = "1"
            memory = "${var.memory}Gi"
          }
        }
      }

      container_concurrency = var.container_concurrency
      timeout_seconds       = var.timeout_seconds
      service_account_name  = var.service_account_email
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/maxScale"      = tostring(var.max_instances)
        "autoscaling.knative.dev/minScale"      = tostring(var.min_instances)
        "run.googleapis.com/client-name"        = "Terraform"
        "run.googleapis.com/cloudsql-instances" = join(",", var.cloudsql_instances)
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }

  dynamic "metadata" {
    for_each = var.labels != {} ? [1] : []
    content {
      labels = var.labels
    }
  }
}

# IAM binding for Cloud Run invoker
resource "google_cloud_run_service_iam_member" "allUsers" {
  count = var.allow_unauthenticated ? 1 : 0

  service  = google_cloud_run_service.main.name
  location = google_cloud_run_service.main.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Run Job for batch evaluation (optional)
resource "google_cloud_run_v2_job" "batch" {
  count = var.enable_batch_job ? 1 : 0

  name     = "${var.project_name}-${var.environment}-batch"
  location = var.region

  template {
    template {
      containers {
        image = var.docker_image_url

        dynamic "env" {
          for_each = var.environment_variables
          content {
            name  = env.key
            value = env.value
          }
        }
      }

      max_retries     = var.batch_max_retries
      timeout         = "${var.batch_timeout_seconds}s"
      service_account = var.service_account_email
    }
  }
}
