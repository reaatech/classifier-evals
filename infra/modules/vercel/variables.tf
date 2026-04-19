/**
 * Vercel Module Variables
 */

variable "project_name" {
  description = "Name of the Vercel project"
  type        = string
}

variable "repo" {
  description = "GitHub repository (e.g., 'owner/repo')"
  type        = string
}

variable "team_id" {
  description = "Vercel team ID"
  type        = string
  default     = null
}

variable "framework" {
  description = "Framework preset (e.g., 'nextjs', 'nuxt', 'static')"
  type        = string
  default     = "nextjs"
}

variable "build_command" {
  description = "Build command"
  type        = string
  default     = "npm run build"
}

variable "install_command" {
  description = "Install command"
  type        = string
  default     = "npm install"
}

variable "output_directory" {
  description = "Output directory"
  type        = string
  default     = ".next"
}

variable "ignore_command" {
  description = "Command to determine if a deployment should be ignored"
  type        = string
  default     = null
}

variable "serverless_function_region" {
  description = "Region for serverless functions"
  type        = string
  default     = "iad1"
}

variable "environment_variables" {
  description = "Environment variables for the project"
  type = list(object({
    key    = string
    value  = string
    target = list(string)
  }))
  default = []
}

variable "extra_environment_variables" {
  description = "Additional environment variables"
  type = map(object({
    value  = string
    target = list(string)
  }))
  default = {}
}

variable "auto_assign_custom_domains" {
  description = "Automatically assign custom domains"
  type        = bool
  default     = true
}

variable "git_lfs_enabled" {
  description = "Enable Git LFS"
  type        = bool
  default     = false
}

variable "root_directory" {
  description = "Root directory of the project"
  type        = string
  default     = null
}

variable "custom_environment_variables" {
  description = "Custom environment variables configuration"
  type = list(object({
    key    = string
    value  = string
    target = list(string)
    id     = optional(string)
  }))
  default = []
}

variable "deploy" {
  description = "Create a deployment"
  type        = bool
  default     = true
}

variable "ref" {
  description = "Git branch or commit to deploy"
  type        = string
  default     = "main"
}

variable "production" {
  description = "Deploy to production"
  type        = bool
  default     = true
}

variable "domain_name" {
  description = "Custom domain name"
  type        = string
  default     = ""
}

variable "alias_domains" {
  description = "List of alias domains"
  type        = list(string)
  default     = []
}

variable "enable_preview_deployments" {
  description = "Enable preview deployments for pull requests"
  type        = bool
  default     = true
}

variable "preview_branch" {
  description = "Branch for preview deployments"
  type        = string
  default     = "develop"
}
