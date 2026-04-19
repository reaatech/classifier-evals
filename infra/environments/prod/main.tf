# Production environment for classifier-evals
# Uses Cloud Run with higher resources and stricter security

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    # bucket = "terraform-state-your-project"
    # prefix = "classifier-evals/prod"
  }
}

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "docker_image" {
  description = "Docker image URL"
  type        = string
}

# Provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
}

# Data sources
data "google_project" "current" {
  project_id = var.project_id
}

# Module: Cloud Run
module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id   = var.project_id
  region       = var.region
  service_name = "classifier-evals-prod"
  image_url    = var.docker_image

  memory        = "2Gi"
  cpu           = 2
  max_instances = 20
  min_instances = 1  # Keep at least one instance warm
  timeout       = 600

  environment_variables = {
    ENVIRONMENT = var.environment
    LOG_LEVEL   = "info"
  }

  secrets = {
    # OPENAI_API_KEY = "openai-api-key"
    # ANTHROPIC_API_KEY = "anthropic-api-key"
    # LANGFUSE_PUBLIC_KEY = "langfuse-public-key"
    # LANGFUSE_SECRET_KEY = "langfuse-secret-key"
  }

  iam_members = [
    # Only allow specific service accounts and users
    # "serviceAccount:ci-runner@${var.project_id}.iam.gserviceaccount.com",
    # "user:platform-team@company.com",
  ]

  ingress_settings = "allow-internal-and-gclb"
}

# Cloud Monitoring alert policy for high error rate
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "classifier-evals-prod-high-error-rate"
  project      = var.project_id

  conditions {
    display_name = "High Error Rate"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"${module.cloud_run.service_name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.\"response_code\"!=\"200\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05  # 5% error rate
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = []  # Add notification channels as needed

  enabled = true
}

# Cloud Monitoring alert policy for high latency
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "classifier-evals-prod-high-latency"
  project      = var.project_id

  conditions {
    display_name = "High Latency"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"${module.cloud_run.service_name}\" AND metric.type=\"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 300000  # 300 seconds (5 minutes)
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  notification_channels = []  # Add notification channels as needed

  enabled = true
}

# Outputs
output "service_url" {
  description = "URL of the deployed service"
  value       = module.cloud_run.service_url
}

output "service_name" {
  description = "Name of the deployed service"
  value       = module.cloud_run.service_name
}
