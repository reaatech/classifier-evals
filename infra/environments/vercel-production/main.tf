/**
 * Vercel Production Environment
 *
 * Deploys classifier-evals to Vercel for static frontend deployment
 * and serverless function execution.
 *
 * Prerequisites:
 * - Vercel CLI installed and authenticated (`vercel login`)
 * - Vercel Pro plan for team features
 * - GitHub repository connected to Vercel
 */

terraform {
  required_version = ">= 1.0"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

provider "vercel" {
  # API token from Vercel CLI or environment variable
  # export VERCEL_API_TOKEN="your-token"
}

# Call the Vercel module
module "vercel" {
  source = "../../modules/vercel"

  # Project configuration
  project_name = "classifier-evals"
  repo         = "reaatech/classifier-evals"

  # Framework preset for Node.js app
  framework         = "nextjs"
  build_command     = "npm run build"
  install_command   = "npm install"
  output_directory  = ".next"
  root_directory    = null

  # Serverless function region
  serverless_function_region = "iad1"

  # Environment variables
  environment_variables = [
    {
      key    = "NODE_ENV"
      value  = "production"
      target = ["production", "preview"]
    },
    {
      key    = "NPM_CONFIG_LEGACY_PEER_DEPS"
      value  = "true"
      target = ["production", "preview"]
    }
  ]

  # Extra environment variables (from variables.tf)
  extra_environment_variables = var.extra_env_vars

  # Git configuration
  git_lfs_enabled = false

  # Custom environment variables
  custom_environment_variables = [
    for key, value in var.extra_env_vars : {
      key    = key
      value  = value.value
      target = coalesce(value.target, ["production"])
    }
  ]

  # Deployment settings
  deploy     = true
  ref        = "main"
  production = true

  # Preview deployments
  enable_preview_deployments = true
  preview_branch             = "develop"

  # Custom domain (optional)
  domain_name  = var.domain_name
  alias_domains = var.alias_domains
}

# Outputs
output "project_id" {
  value = module.vercel.project_id
}

output "project_url" {
  value = module.vercel.project_url
}

output "deployment_url" {
  value = module.vercel.deployment_url
}

output "preview_url" {
  value = module.vercel.preview_url
}

output "custom_domain" {
  value = module.vercel.custom_domain
}
