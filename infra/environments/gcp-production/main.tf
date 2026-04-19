terraform {
  required_version = ">= 1.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "classifier-evals-tfstate"
    prefix = "gcp-production"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

module "gcp_cloud_run" {
  source = "../../modules/gcp-cloud-run"

  project_name           = var.project_name
  environment            = var.environment
  region                 = var.region
  docker_image_url       = var.docker_image_url
  service_account_email  = google_service_account.app.email
  memory                 = var.memory
  container_concurrency  = var.container_concurrency
  timeout_seconds        = var.timeout_seconds
  max_instances          = var.max_instances
  min_instances          = var.min_instances
  allow_unauthenticated  = var.allow_unauthenticated
  environment_variables  = var.environment_variables
  labels                 = var.labels
  enable_batch_job       = var.enable_batch_job

  depends_on = [google_project_iam_member.artifact_registry]
}

resource "google_service_account" "app" {
  account_id   = "${var.project_name}-${var.environment}"
  display_name = "Service account for ${var.project_name} ${var.environment}"
}

resource "google_project_iam_member" "artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.app.email}"
}
