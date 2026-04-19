variable "project_name" {
  description = "Name of the project (e.g., classifier-evals)"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "resource_group_name" {
  description = "Name of the resource group to deploy into"
  type        = string
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "docker_image_url" {
  description = "Full Docker image URL (e.g., registry/app:tag)"
  type        = string
}

variable "cpu" {
  description = "Number of CPU cores (0.25, 0.5, 0.75, 1.0, etc.)"
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Memory in GiB (1, 2, 4, etc.)"
  type        = number
  default     = 1
}

variable "min_replicas" {
  description = "Minimum number of replicas (0 for scale-to-zero)"
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum number of replicas"
  type        = number
  default     = 10
}

variable "environment_variables" {
  description = "Map of environment variables to pass to the container"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Map of tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "create_log_analytics" {
  description = "Whether to create a Log Analytics workspace"
  type        = bool
  default     = true
}

variable "enable_diagnostics" {
  description = "Whether to enable diagnostic settings"
  type        = bool
  default     = true
}
