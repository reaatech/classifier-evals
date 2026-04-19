output "site_id" {
  description = "Netlify Site ID"
  value       = netlify_site.main.id
}

output "site_url" {
  description = "Netlify Site URL"
  value       = netlify_site.main.ssl_url
}

output "admin_url" {
  description = "Netlify Admin URL"
  value       = netlify_site.main.admin_url
}

output "build_hook_url" {
  description = "Build hook URL for CI/CD"
  value       = try(netlify_build_hook.main.url, null)
}

output "site_name" {
  description = "Netlify Site Name"
  value       = netlify_site.main.name
}

output "deploy_url" {
  description = "Default deploy URL"
  value       = netlify_site.main.url
}

output "api_url" {
  description = "API endpoint for Netlify API"
  value       = "https://api.netlify.com/api/v1/sites/${netlify_site.main.id}"
}
