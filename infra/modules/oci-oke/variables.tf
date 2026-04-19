variable "compartment_id" {
  description = "OCI compartment ID"
  type        = string
}

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "create_cluster" {
  description = "Whether to create a new OKE cluster"
  type        = bool
  default     = true
}

variable "kubernetes_version" {
  description = "Kubernetes version for the cluster"
  type        = string
  default     = "v1.27.1"
}

variable "vcn_cidr" {
  description = "CIDR block for the VCN"
  type        = string
  default     = "10.0.0.0/16"
}

variable "cluster_subnet_cidr" {
  description = "CIDR block for the cluster subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "lb_subnet_cidr" {
  description = "CIDR block for the load balancer subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "cluster_is_public" {
  description = "Whether the cluster endpoint is public"
  type        = bool
  default     = true
}

variable "cluster_nsg_ids" {
  description = "List of NSG IDs for the cluster endpoint"
  type        = list(string)
  default     = []
}

variable "node_pool_size" {
  description = "Number of nodes in the node pool"
  type        = number
  default     = 2
}

variable "node_shape" {
  description = "Shape of the nodes"
  type        = string
  default     = "VM.Standard.E4.Flex"
}

variable "node_shape_config" {
  description = "Configuration for node shape"
  type = list(object({
    memory_in_gbs = optional(number)
    ocpus         = optional(number)
  }))
  default = []
}

variable "node_ssh_public_key" {
  description = "SSH public key for node access"
  type        = string
  default     = ""
}

variable "repository_is_public" {
  description = "Whether the container registry repository is public"
  type        = bool
  default     = false
}

variable "deploy_app" {
  description = "Whether to deploy the application"
  type        = bool
  default     = true
}

variable "kubernetes_namespace" {
  description = "Kubernetes namespace for the application"
  type        = string
  default     = "default"
}

variable "docker_image_url" {
  description = "Docker image URL"
  type        = string
}

variable "replica_count" {
  description = "Number of replicas"
  type        = number
  default     = 2
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "service_port" {
  description = "Service port"
  type        = number
  default     = 80
}

variable "cpu_request" {
  description = "CPU request for the container"
  type        = string
  default     = "100m"
}

variable "memory_request" {
  description = "Memory request for the container"
  type        = string
  default     = "256Mi"
}

variable "cpu_limit" {
  description = "CPU limit for the container"
  type        = string
  default     = "1000m"
}

variable "memory_limit" {
  description = "Memory limit for the container"
  type        = string
  default     = "1Gi"
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
