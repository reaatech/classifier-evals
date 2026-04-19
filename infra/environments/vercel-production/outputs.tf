/**
 * Vercel Environment Outputs
 */

output "project_id" {
  description = "Vercel project ID"
  value       = module.vercel.project_id
}

output "project_url" {
  description = "Vercel project URL"
  value       = module.vercel.project_url
}

output "deployment_url" {
  description = "Vercel deployment URL"
  value       = module.vercel.deployment_url
}

output "preview_url" {
  description = "Vercel preview URL"
  value       = module.vercel.preview_url
}

output "custom_domain" {
  description = "Custom domain configuration"
  value       = module.vercel.custom_domain
}
