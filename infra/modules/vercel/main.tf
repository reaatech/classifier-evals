/**
 * Vercel Deployment Module for classifier-evals
 *
 * This module creates Vercel projects and configures deployment settings.
 */

terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 1.0"
    }
  }
}

# Vercel Project
resource "vercel_project" "main" {
  name      = var.project_name
  framework = var.framework

  git_repository = {
    type = "github"
    repo = var.repo
  }

  build_command                = var.build_command
  install_command              = var.install_command
  output_directory             = var.output_directory
  ignore_command               = var.ignore_command
  serverless_function_region   = var.serverless_function_region
  environment_variables        = var.environment_variables
  auto_assign_custom_domains   = var.auto_assign_custom_domains
  git_lfs_enabled              = var.git_lfs_enabled
  root_directory               = var.root_directory
  custom_environment_variables = var.custom_environment_variables
}

# Vercel Environment Variables
resource "vercel_project_environment_variable" "variables" {
  for_each = var.extra_environment_variables

  project_id = vercel_project.main.id
  team_id    = var.team_id
  key        = each.key
  value      = each.value.value
  target     = each.value.target
}

# Vercel Deployment
resource "vercel_deployment" "main" {
  count = var.deploy ? 1 : 0

  project_id = vercel_project.main.id
  team_id    = var.team_id
  ref        = var.ref
  production = var.production

  depends_on = [vercel_project_environment_variable.variables]
}

# Vercel Project Domain (optional)
resource "vercel_project_domain" "main" {
  count = var.domain_name != "" ? 1 : 0

  project_id = vercel_project.main.id
  team_id    = var.team_id
  domain     = var.domain_name
}

# Vercel Alias (optional)
resource "vercel_project_domain" "alias" {
  for_each = var.alias_domains

  project_id = vercel_project.main.id
  team_id    = var.team_id
  domain     = each.value
}

# Vercel Previews Configuration
resource "vercel_project_github_deployment" "preview" {
  count = var.enable_preview_deployments ? 1 : 0

  project_id = vercel_project.main.id
  team_id    = var.team_id
  ref        = var.preview_branch
  production = false
}
