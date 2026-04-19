output "app_url" {
  description = "URL of the deployed application"
  value       = module.container_apps.app_url
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "container_app_name" {
  description = "Name of the Container App"
  value       = module.container_apps.container_app_name
}

output "location" {
  description = "Azure region where resources are deployed"
  value       = var.location
}
