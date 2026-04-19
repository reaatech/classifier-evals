variable "service_name" {
  description = "Name of the service"
  type        = string
}

variable "region" {
  description = "AWS region"
  type        = string
}

variable "image_url" {
  description = "Docker image URL"
  type        = string
}

variable "cpu" {
  description = "CPU units for the task (256, 512, 1024, 2048, 4096)"
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memory in MB for the task (512, 1024, 2048, 4096, 8192)"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of running tasks"
  type        = number
  default     = 1
}

variable "create_cluster" {
  description = "Whether to create a new ECS cluster"
  type        = bool
  default     = true
}

variable "cluster_arn" {
  description = "ARN of existing ECS cluster (if create_cluster is false)"
  type        = string
  default     = ""
}

variable "cluster_name" {
  description = "Name of existing ECS cluster (if create_cluster is false)"
  type        = string
  default     = ""
}

variable "subnet_ids" {
  description = "List of subnet IDs for the service"
  type        = list(string)
}

variable "security_group_ids" {
  description = "List of security group IDs"
  type        = list(string)
}

variable "environment_variables" {
  description = "Map of environment variables"
  type        = map(string)
  default     = {}
}

variable "enable_secrets" {
  description = "Whether to enable secrets from AWS Secrets Manager"
  type        = bool
  default     = false
}

variable "secret_arns" {
  description = "List of secret ARNs"
  type        = list(string)
  default     = []
}

variable "secrets" {
  description = "List of secrets to inject into the container"
  type = list(object({
    name = string
    arn  = string
  }))
  default = []
}

variable "enable_health_check" {
  description = "Whether to enable health check"
  type        = bool
  default     = true
}

variable "cpu_architecture" {
  description = "CPU architecture (X86_64 or ARM64)"
  type        = string
  default     = "X86_64"
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30
}

variable "enable_autoscaling" {
  description = "Whether to enable auto scaling"
  type        = bool
  default     = false
}

variable "min_capacity" {
  description = "Minimum number of tasks"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of tasks"
  type        = number
  default     = 4
}

variable "cpu_target_value" {
  description = "Target CPU utilization percentage"
  type        = number
  default     = 70
}

variable "memory_target_value" {
  description = "Target memory utilization percentage"
  type        = number
  default     = 70
}

variable "lb_arn" {
  description = "ARN of the load balancer"
  type        = string
  default     = ""
}

variable "lb_target_group_arn" {
  description = "ARN of the target group"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
