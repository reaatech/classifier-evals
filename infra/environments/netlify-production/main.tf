terraform {
  required_version = ">= 1.0.0"
  required_providers {
    netlify = {
      source  = "netlify/netlify"
      version = "~> 0.1"
    }
  }
}

module "netlify" {
  source = "../../modules/netlify"

  project_name  = var.project_name
  environment   = var.environment
  account_name  = var.account_name
  account_slug  = var.account_slug
  deploy_hook   = var.deploy_hook
  notification_email = var.notification_email
  build_dir     = var.build_dir
  functions_dir = var.functions_dir
  build_command = var.build_command
  publish_dir   = var.publish_dir
  default_branch = var.default_branch
  environment_variables = var.environment_variables
  context       = var.context
  branch        = var.branch
  prerender     = var.prerender
  processing_settings = var.processing_settings
}
