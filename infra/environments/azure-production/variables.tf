variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "classifier-evals"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus"
}

variable "docker_image_url" {
  description = "Docker image URL for the application"
  type        = string
}

variable "cpu" {
  description = "Number of CPU cores for the container"
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Memory in GiB for the container"
  type        = number
  default     = 1.0
}

variable "min_replicas" {
  description = "Minimum number of replicas"
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum number of replicas"
  type        = number
  default     = 10
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
