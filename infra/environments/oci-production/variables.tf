variable "tenancy_ocid" {
  description = "OCI tenancy OCID"
  type        = string
}

variable "user_ocid" {
  description = "OCI user OCID"
  type        = string
}

variable "fingerprint" {
  description = "API signing certificate fingerprint"
  type        = string
}

variable "private_key_path" {
  description = "Path to the private key for API signing"
  type        = string
  sensitive   = true
}

variable "region" {
  description = "OCI region"
  type        = string
  default     = "us-phoenix-1"
}

variable "compartment_id" {
  description = "Compartment ID for resources"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "classifier-evals"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "create_cluster" {
  description = "Create new OKE cluster"
  type        = bool
  default     = true
}

variable "kubernetes_version" {
  description = "Kubernetes version for OKE cluster"
  type        = string
  default     = "v1.27.0"
}

variable "vcn_cidr" {
  description = "CIDR block for VCN"
  type        = string
  default     = "10.0.0.0/16"
}

variable "cluster_subnet_cidr" {
  description = "CIDR block for cluster subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "lb_subnet_cidr" {
  description = "CIDR block for load balancer subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "cluster_is_public" {
  description = "Whether cluster is public"
  type        = bool
  default     = true
}

variable "node_pool_size" {
  description = "Number of worker nodes"
  type        = number
  default     = 3
}

variable "node_shape" {
  description = "Instance shape for worker nodes"
  type        = string
  default     = "VM.Standard.E4.Flex"
}

variable "node_ssh_public_key" {
  description = "SSH public key for worker nodes"
  type        = string
  default     = ""
}

variable "auth_token_id" {
  description = "Auth token ID for Kubernetes authentication"
  type        = string
}

variable "docker_image_url" {
  description = "Docker image URL"
  type        = string
}

variable "replica_count" {
  description = "Number of replicas"
  type        = number
  default     = 3
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
  description = "CPU request"
  type        = string
  default     = "250m"
}

variable "memory_request" {
  description = "Memory request"
  type        = string
  default     = "512Mi"
}

variable "cpu_limit" {
  description = "CPU limit"
  type        = string
  default     = "500m"
}

variable "memory_limit" {
  description = "Memory limit"
  type        = string
  default     = "1Gi"
}

variable "environment_variables" {
  description = "Environment variables for the container"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
  default     = {}
}
