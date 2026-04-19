variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "classifier-evals"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "docker_image_url" {
  description = "Docker image URL (e.g., gcr.io/project/image:tag)"
  type        = string
}

variable "memory" {
  description = "Memory limit for Cloud Run service (e.g., '512Mi', '1Gi')"
  type        = string
  default     = "512Mi"
}

variable "container_concurrency" {
  description = "Maximum number of concurrent requests per container instance"
  type        = number
  default     = 80
}

variable "timeout_seconds" {
  description = "Request timeout in seconds"
  type        = number
  default     = 300
}

variable "max_instances" {
  description = "Maximum number of container instances"
  type        = number
  default     = 100
}

variable "min_instances" {
  description = "Minimum number of container instances (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated invocations"
  type        = bool
  default     = true
}

variable "environment_variables" {
  description = "Environment variables to set on the service"
  type        = map(string)
  default     = {}
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

variable "enable_batch_job" {
  description = "Enable Cloud Run Job for batch evaluation workloads"
  type        = bool
  default     = true
}
