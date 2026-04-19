/**
 * Vercel Module Outputs
 */

output "project_id" {
  description = "Vercel project ID"
  value       = vercel_project.main.id
}

output "project_name" {
  description = "Vercel project name"
  value       = vercel_project.main.name
}

output "project_url" {
  description = "Vercel project URL"
  value       = vercel_project.main.url
}

output "deployment_id" {
  description = "Vercel deployment ID"
  value       = var.deploy ? vercel_deployment.main[0].id : null
}

output "deployment_url" {
  description = "Vercel deployment URL"
  value       = var.deploy ? vercel_deployment.main[0].url : null
}

output "preview_url" {
  description = "Vercel preview URL"
  value       = var.deploy ? vercel_deployment.main[0].preview_url : null
}

output "custom_domain" {
  description = "Custom domain configured"
  value       = var.domain_name != "" ? var.domain_name : null
}

output "alias_domains" {
  description = "List of alias domains"
  value       = var.alias_domains
}
