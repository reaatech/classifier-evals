output "cluster_id" {
  description = "ID of the OKE cluster"
  value       = try(oci_containerengine_cluster.main[0].id, null)
}

output "cluster_endpoint" {
  description = "Endpoint of the OKE cluster"
  value       = try(oci_containerengine_cluster.main[0].endpoints[0].public_endpoint, null)
}

output "vcn_id" {
  description = "ID of the VCN"
  value       = try(oci_core_vcn.main[0].id, null)
}

output "node_pool_id" {
  description = "ID of the node pool"
  value       = try(oci_containerengine_node_pool.main[0].id, null)
}

output "container_registry_url" {
  description = "URL of the container registry repository"
  value       = try(oci_artifacts_container_repository.main.name, null)
}

output "load_balancer_ip" {
  description = "IP address of the load balancer"
  value       = try(kubernetes_service.main[0].status[0].load_balancer[0].ingress[0].ip, null)
}

output "service_url" {
  description = "URL of the deployed service"
  value       = try(kubernetes_service.main[0].status[0].load_balancer[0].ingress[0].ip, null)
}
