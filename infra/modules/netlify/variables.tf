variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "production"
}

variable "account_name" {
  description = "Netlify account name"
  type        = string
  default     = null
}

variable "account_slug" {
  description = "Netlify account slug"
  type        = string
  default     = null
}

variable "deploy_hook" {
  description = "Deploy hook URL for CI/CD"
  type        = string
  default     = null
}

variable "notification_email" {
  description = "Email for build notifications"
  type        = string
  default     = null
}

variable "build_dir" {
  description = "Build directory"
  type        = string
  default     = ""
}

variable "functions_dir" {
  description = "Serverless functions directory"
  type        = string
  default     = "netlify/functions"
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

variable "base_dir" {
  description = "Base directory for monorepos"
  type        = string
  default     = ""
}

variable "default_branch" {
  description = "Default branch for deploys"
  type        = string
  default     = "main"
}

variable "environment_variables" {
  description = "Environment variables to set in Netlify"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "context" {
  description = "Deployment context (production, deploy-preview, branch-deploy)"
  type        = string
  default     = "production"
}

variable "branch" {
  description = "Branch to deploy"
  type        = string
  default     = "main"
}

variable "prerender" {
  description = "Prerender the site"
  type        = bool
  default     = false
}

variable "processing_settings" {
  description = "Processing settings for CSS/JS bundling"
  type = object({
    css   = optional(bool)
    js    = optional(bool)
    images = optional(bool)
    html  = optional(bool)
  })
  default = null
}
