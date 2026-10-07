terraform {
  required_providers {
    neon = {
      source = "terraform-community-providers/neon"
    }
  }
}

variable "run_id" { type = string }
variable "allowed_ip_addresses" { type = list(string) }

resource "neon_project" "staging" {
  name       = "cza-f3-${lower(var.run_id)}"
  region_id  = "aws-eu-central-1"
  pg_version = 17

  allowed_ips = {
    ips                     = var.allowed_ip_addresses
    protected_branches_only = false
  }

  branch = {
    name      = "main"
    protected = false
    endpoint = {
      min_cu          = 0.25
      max_cu          = 0.25
      suspend_timeout = 300
    }
  }
}

resource "neon_role" "migrator" {
  project_id = neon_project.staging.id
  branch_id  = neon_project.staging.branch.id
  name       = "cza_faz3_migrator"
}

resource "neon_role" "origin_runtime" {
  project_id = neon_project.staging.id
  branch_id  = neon_project.staging.branch.id
  name       = "cza_faz3_origin_runtime"
}

resource "neon_database" "security" {
  project_id = neon_project.staging.id
  branch_id  = neon_project.staging.branch.id
  name       = "cza_faz3_staging"
  owner_name = neon_role.migrator.name
}

output "project_id" {
  value     = neon_project.staging.id
  sensitive = true
}

output "migrator_database_url" {
  value     = "postgresql://${neon_role.migrator.name}:${urlencode(neon_role.migrator.password)}@${neon_project.staging.branch.endpoint.host}/${neon_database.security.name}?sslmode=require"
  sensitive = true
}

output "runtime_database_url" {
  value     = "postgresql://${neon_role.origin_runtime.name}:${urlencode(neon_role.origin_runtime.password)}@${neon_project.staging.branch.endpoint.host}/${neon_database.security.name}?sslmode=require"
  sensitive = true
}
