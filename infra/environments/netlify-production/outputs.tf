output "site_url" {
  description = "Netlify site URL"
  value       = module.netlify.site_url
}

output "admin_url" {
  description = "Netlify admin URL"
  value       = module.netlify.admin_url
}

output "site_id" {
  description = "Netlify site ID"
  value       = module.netlify.site_id
}

output "build_hook_url" {
  description = "Build hook URL"
  value       = module.netlify.build_hook_url
}

output "dns_zone_id" {
  description = "DNS zone ID"
  value       = module.netlify.dns_zone_id
}

output "deploy_url" {
  description = "Deploy URL"
  value       = module.netlify.deploy_url
}

output "ssl_url" {
  description = "SSL URL"
  value       = module.netlify.ssl_url
}
