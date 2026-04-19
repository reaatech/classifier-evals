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

variable "account_name" {
  description = "Netlify account name"
  type        = string
  default     = ""
}

variable "account_slug" {
  description = "Netlify account slug"
  type        = string
  default     = ""
}

variable "deploy_hook" {
  description = "Deploy hook URL"
  type        = string
  default     = ""
}

variable "notification_email" {
  description = "Notification email"
  type        = string
  default     = ""
}

variable "build_dir" {
  description = "Build directory"
  type        = string
  default     = "."
}

variable "functions_dir" {
  description = "Functions directory"
  type        = string
  default     = ""
}

variable "build_command" {
  description = "Build command"
  type        = string
  default     = "npm run build"
}

variable "publish_dir" {
  description = "Publish directory"
  type        = string
  default     = "dist"
}

variable "default_branch" {
  description = "Default branch"
  type        = string
  default     = "main"
}

variable "environment_variables" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "context" {
  description = "Deploy context"
  type        = string
  default     = "production"
}

variable "branch" {
  description = "Branch name"
  type        = string
  default     = "main"
}

variable "prerender" {
  description = "Prerender settings"
  type        = any
  default     = null
}

variable "processing_settings" {
  description = "Processing settings"
  type        = any
  default     = null
}
