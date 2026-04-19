output "service_url" {
  description = "URL of the deployed service"
  value       = "http://${module.ecs.service_name}.${var.aws_region}.amazonaws.com"
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "security_group_id" {
  description = "ID of the security group"
  value       = aws_security_group.main.id
}
