/**
 * Vercel Environment Variables
 */

variable "domain_name" {
  description = "Custom domain name (optional)"
  type        = string
  default     = ""
}

variable "alias_domains" {
  description = "List of alias domains"
  type        = list(string)
  default     = []
}

variable "extra_env_vars" {
  description = "Extra environment variables as map of objects with value and optional target"
  type = map(object({
    value  = string
    target = optional(list(string))
  }))
  default = {}
}
