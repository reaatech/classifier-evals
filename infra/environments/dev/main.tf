# Development environment for classifier-evals
# Uses Cloud Run for serverless deployment

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
    # prefix = "classifier-evals/dev"
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
  default     = "dev"
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

  project_id  = var.project_id
  region      = var.region
  service_name = "classifier-evals-dev"
  image_url   = var.docker_image

  memory       = "1Gi"
  cpu          = 1
  max_instances = 5
  min_instances = 0  # Scale to zero for dev
  timeout      = 300

  environment_variables = {
    ENVIRONMENT = var.environment
    LOG_LEVEL   = "debug"
  }

  secrets = {
    # OPENAI_API_KEY = "openai-api-key"
    # ANTHROPIC_API_KEY = "anthropic-api-key"
  }

  iam_members = [
    "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com",
  ]
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
