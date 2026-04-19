output "service_endpoint" {
  description = "Service endpoint URL"
  value       = module.oci_oke.service_endpoint
}

output "load_balancer_ip" {
  description = "Load balancer IP address"
  value       = module.oci_oke.load_balancer_ip
}

output "cluster_id" {
  description = "OKE cluster ID"
  value       = module.oci_oke.cluster_id
}

output "cluster_name" {
  description = "OKE cluster name"
  value       = module.oci_oke.cluster_name
}

output "node_pool_id" {
  description = "Node pool ID"
  value       = module.oci_oke.node_pool_id
}

output "vcn_id" {
  description = "VCN ID"
  value       = module.oci_oke.vcn_id
}
