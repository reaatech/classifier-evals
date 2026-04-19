output "container_app_name" {
  description = "Name of the Container App"
  value       = azurerm_container_app.main.name
}

output "container_app_url" {
  description = "URL of the Container App"
  value       = azurerm_container_app.main.ingress[0].fqdn
}

output "container_app_environment_id" {
  description = "ID of the Container App Environment"
  value       = azurerm_container_app_environment.main.id
}

output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = var.create_log_analytics ? azurerm_log_analytics_workspace.main[0].id : null
}
