# OCI OKE Module for classifier-evals
# Deploys the service to Oracle Cloud Infrastructure Container Engine for Kubernetes

locals {
  module_name = "oci-oke"
  common_tags = merge(var.tags, {
    Name        = "${var.project_name}-${var.environment}"
    Environment = var.environment
    ManagedBy   = "terraform"
    Module      = local.module_name
  })
}

# Container Engine for Kubernetes (OKE) Cluster
resource "oci_containerengine_cluster" "main" {
  count = var.create_cluster ? 1 : 0

  cluster_options {
    service_lb_subnet_ids = [oci_core_subnet.lb[0].id]
  }

  compartment_id = var.compartment_id
  endpoint_config {
    is_public_ip_enabled = var.cluster_is_public
    nsg_ids              = var.cluster_nsg_ids
    subnet_id            = oci_core_subnet.cluster[0].id
  }
  kubernetes_version = var.kubernetes_version
  name               = "${var.project_name}-${var.environment}-cluster"
  vcn_id             = oci_core_vcn.main[0].id
  lifecycle {
    create_before_destroy = true
  }
}

# VCN for OKE (created when create_cluster is true)
resource "oci_core_vcn" "main" {
  count = var.create_cluster ? 1 : 0

  compartment_id      = var.compartment_id
  display_name        = "${var.project_name}-${var.environment}-vcn"
  dns_label           = "okevcn"
  cidr_blocks         = [var.vcn_cidr]
}

# Internet Gateway
resource "oci_core_internet_gateway" "main" {
  count = var.create_cluster ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-${var.environment}-igw"
  vcn_id         = oci_core_vcn.main[0].id
}

# Route Table for cluster endpoints
resource "oci_core_route_table" "cluster" {
  count = var.create_cluster ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-${var.environment}-cluster-rt"
  vcn_id         = oci_core_vcn.main[0].id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.main[0].id
  }
}

# Route Table for load balancer
resource "oci_core_route_table" "lb" {
  count = var.create_cluster ? 1 : 0

  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-${var.environment}-lb-rt"
  vcn_id         = oci_core_vcn.main[0].id

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.main[0].id
  }
}

# Subnet for cluster endpoints
resource "oci_core_subnet" "cluster" {
  count = var.create_cluster ? 1 : 0

  compartment_id  = var.compartment_id
  display_name    = "${var.project_name}-${var.environment}-cluster-subnet"
  vcn_id          = oci_core_vcn.main[0].id
  cidr_block      = var.cluster_subnet_cidr
  dns_label       = "clsub"
  route_table_id  = oci_core_route_table.cluster[0].id
  security_list_ids = [oci_core_vcn.main[0].default_security_list_id]
}

# Subnet for load balancer
resource "oci_core_subnet" "lb" {
  count = var.create_cluster ? 1 : 0

  compartment_id  = var.compartment_id
  display_name    = "${var.project_name}-${var.environment}-lb-subnet"
  vcn_id          = oci_core_vcn.main[0].id
  cidr_block      = var.lb_subnet_cidr
  dns_label       = "lbsub"
  route_table_id  = oci_core_route_table.lb[0].id
  security_list_ids = [oci_core_vcn.main[0].default_security_list_id]
}

# Node Pool
resource "oci_containerengine_node_pool" "main" {
  count = var.create_cluster ? 1 : 0

  compartment_id = var.compartment_id
  cluster_id     = oci_containerengine_cluster.main[0].id
  kubernetes_version = var.kubernetes_version
  name           = "${var.project_name}-${var.environment}-nodepool"
  vcn_id         = oci_core_vcn.main[0].id

  node_config_details {
    placement_configs {
      subnet_id = oci_core_subnet.cluster[0].id
    }
    size = var.node_pool_size
  }

  node_shape = var.node_shape

  ssh_public_key = var.node_ssh_public_key

  dynamic "node_shape_config" {
    for_each = var.node_shape_config
    content {
      memory_in_gbs = try(node_shape_config.value.memory_in_gbs, null)
      ocpus          = try(node_shape_config.value.ocps, null)
    }
  }
}

# Container Registry Repository
resource "oci_artifacts_container_repository" "main" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-${var.environment}"
  is_public      = var.repository_is_public
}

# Kubernetes Namespace
resource "kubernetes_namespace" "main" {
  count = var.deploy_app ? 1 : 0

  metadata {
    name = var.kubernetes_namespace
    labels = local.common_tags
  }

  # This requires kubernetes provider configured with OKE credentials
  # In practice, this would be managed separately or via helm
}

# Deployment
resource "kubernetes_deployment" "main" {
  count = var.deploy_app ? 1 : 0

  metadata {
    name      = "${var.project_name}-deployment"
    namespace = var.kubernetes_namespace
    labels    = local.common_tags
  }

  spec {
    replicas = var.replica_count

    selector {
      match_labels = {
        app = var.project_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.project_name
        }
      }

      spec {
        container {
          image = var.docker_image_url
          name  = var.project_name
          port {
            container_port = var.container_port
          }

          dynamic "env" {
            for_each = var.environment_variables
            content {
              name  = env.key
              value = env.value
            }
          }

          resources {
            requests = {
              cpu    = var.cpu_request
              memory = var.memory_request
            }
            limits = {
              cpu    = var.cpu_limit
              memory = var.memory_limit
            }
          }
        }
      }
    }
  }
}

# Service (LoadBalancer)
resource "kubernetes_service" "main" {
  count = var.deploy_app ? 1 : 0

  metadata {
    name      = "${var.project_name}-service"
    namespace = var.kubernetes_namespace
    labels    = local.common_tags
  }

  spec {
    selector = {
      app = var.project_name
    }

    port {
      port        = var.service_port
      target_port = var.container_port
    }

    type = "LoadBalancer"

    load_balancer {
      subnet_ids = [oci_core_subnet.lb[0].id]
    }
  }
}
