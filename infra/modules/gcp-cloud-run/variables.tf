variable "project_name" {
  description = "Name of the project (e.g., classifier-evals)"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
}

variable "region" {
  description = "GCP region (e.g., us-central1)"
  type        = string
}

variable "docker_image_url" {
  description = "Full Docker image URL (e.g., gcr.io/project/image:tag)"
  type        = string
}

variable "service_account_email" {
  description = "Service account email for the Cloud Run service"
  type        = string
  default     = null
}

variable "memory" {
  description = "Memory limit in Gi (e.g., 1, 2, 4)"
  type        = number
  default     = 1
}

variable "container_concurrency" {
  description = "Maximum concurrent requests per container instance"
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
  default     = 10
}

variable "min_instances" {
  description = "Minimum number of container instances (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "allow_unauthenticated" {
  description = "Allow unauthenticated invocations"
  type        = bool
  default     = false
}

variable "environment_variables" {
  description = "Environment variables to pass to the container"
  type        = map(string)
  default     = {}
}

variable "labels" {
  description = "Labels to apply to resources"
  type        = map(string)
  default     = {}
}

variable "cloudsql_instances" {
  description = "List of Cloud SQL instances to connect to"
  type        = list(string)
  default     = []
}

variable "enable_batch_job" {
  description = "Enable Cloud Run Job for batch evaluation"
  type        = bool
  default     = false
}

variable "batch_max_retries" {
  description = "Maximum number of retries for batch job"
  type        = number
  default     = 3
}

variable "batch_timeout_seconds" {
  description = "Timeout for batch job in seconds"
  type        = number
  default     = 3600
}
