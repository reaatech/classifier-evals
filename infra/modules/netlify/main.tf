terraform {
  required_providers {
    netlify = {
      source  = "netlify/netlify"
      version = "~> 0.7"
    }
  }
}

resource "netlify_site" "main" {
  name           = "${var.project_name}-${var.environment}"
  account_name   = var.account_name
  account_slug   = var.account_slug
  ssl            = true
  force_ssl      = true
  managed_dns    = true
  deploy_hook    = var.deploy_hook
  notification   = var.notification_email
  build_dir      = var.build_dir
  functions_dir  = var.functions_dir
  cmd            = var.build_command
  dir            = var.publish_dir
  base           = var.base_dir
  env = merge(
    {
      NODE_ENV = var.environment
    },
    var.environment_variables
  )
}

resource "netlify_build_hook" "main" {
  site_id = netlify_site.main.id
  title   = "CI/CD Build Trigger"
  branch  = var.default_branch
}

resource "netlify_snippet" "headers" {
  site_id = netlify_site.main.id
  title   = "Security Headers"
  body    = <<EOF
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
EOF
}
