terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

module "container_apps" {
  source = "../../modules/azure-container-apps"

  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  environment_name    = "${var.project_name}-${var.environment}-env"
  app_name            = var.project_name
  docker_image_url    = var.docker_image_url

  cpu           = var.cpu
  memory        = var.memory
  min_replicas  = var.min_replicas
  max_replicas  = var.max_replicas

  environment_variables = var.environment_variables

  tags = merge(
    {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "Terraform"
    },
    var.tags
  )
}

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-${var.environment}-rg"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}
