terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

data "azurerm_client_config" "current" {}

resource "azurerm_log_analytics_workspace" "main" {
  count               = var.create_log_analytics ? 1 : 0
  name                = "${var.project_name}-logs-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  retention_in_days   = 30
  sku                 = "PerGB2018"

  tags = var.tags
}

resource "azurerm_log_analytics_solution" "main" {
  count                 = var.create_log_analytics ? 1 : 0
  solution_name         = "ContainerInsights"
  location              = var.location
  resource_group_name   = var.resource_group_name
  workspace_resource_id = azurerm_log_analytics_workspace.main[0].id
  workspace_name        = azurerm_log_analytics_workspace.main[0].name

  plan {
    publisher = "Microsoft"
    product   = "OMSGallery/ContainerInsights"
  }

  tags = var.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project_name}-cae-${var.environment}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.create_log_analytics ? azurerm_log_analytics_workspace.main[0].id : null

  tags = var.tags
}

resource "azurerm_container_app" "main" {
  name                         = "${var.project_name}-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  tags = var.tags

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = var.project_name
      image  = var.docker_image_url
      cpu    = var.cpu
      memory = "${var.memory}Gi"

      dynamic "env" {
        for_each = var.environment_variables
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }

  ingress {
    allow_insecure_connections = false
    external_enabled           = true
    target_port                = 3000
    transport                  = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }
}

resource "azurerm_monitor_diagnostic_setting" "container_app" {
  count                        = var.enable_diagnostics ? 1 : 0
  name                         = "${azurerm_container_app.main.name}-diagnostics"
  target_resource_id           = azurerm_container_app.main.id
  log_analytics_workspace_id   = var.create_log_analytics ? azurerm_log_analytics_workspace.main[0].id : null
  log_analytics_destination_type = "AzureDiagnostics"

  enabled_log {
    category = "ContainerAppConsole"
  }

  enabled_log {
    category = "ContainerAppSystem"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}
