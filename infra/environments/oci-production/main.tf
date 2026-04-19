terraform {
  required_version = ">= 1.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

provider "kubernetes" {
  host                   = module.oci_oke.cluster_endpoint
  cluster_ca_certificate = base64decode(module.oci_oke.cluster_ca_certificate)
  token                  = data.oci_identity_auth_token.token.token
}

data "oci_identity_auth_token" "token" {
  auth_token_id = var.auth_token_id
}

module "oci_oke" {
  source = "../../modules/oci-oke"

  compartment_id      = var.compartment_id
  project_name        = var.project_name
  environment         = var.environment
  create_cluster      = var.create_cluster
  kubernetes_version  = var.kubernetes_version
  vcn_cidr            = var.vcn_cidr
  cluster_subnet_cidr = var.cluster_subnet_cidr
  lb_subnet_cidr      = var.lb_subnet_cidr
  cluster_is_public   = var.cluster_is_public
  node_pool_size      = var.node_pool_size
  node_shape          = var.node_shape
  node_ssh_public_key = var.node_ssh_public_key
  docker_image_url    = var.docker_image_url
  replica_count       = var.replica_count
  container_port      = var.container_port
  service_port        = var.service_port
  cpu_request         = var.cpu_request
  memory_request      = var.memory_request
  cpu_limit           = var.cpu_limit
  memory_limit        = var.memory_limit
  environment_variables = var.environment_variables
  tags                = var.tags
}
