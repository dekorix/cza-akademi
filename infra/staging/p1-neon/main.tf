locals {
  project_name = "cza-f3-staging-${lower(var.run_id)}"
  direct_host  = neon_project.staging.branch.endpoint.host
  host_labels  = split(".", local.direct_host)
  pooled_host  = join(".", concat(["${local.host_labels[0]}-pooler"], slice(local.host_labels, 1, length(local.host_labels))))
}

resource "neon_project" "staging" {
  name       = local.project_name
  region_id  = "aws-eu-central-1"
  pg_version = 17

  branch = {
    name      = "main"
    protected = false
    endpoint = {
      min_cu          = 0.25
      max_cu          = 0.25
      suspend_timeout = 300
    }
  }

  lifecycle {
    precondition {
      condition     = var.environment == "staging" && !can(regex("(^|[-_.])(prod|production)([-_.]|$)", lower(local.project_name)))
      error_message = "NEON_STAGING_ONLY"
    }
    precondition {
      condition     = length(var.production_endpoint_sha256_denylist) > 0
      error_message = "PRODUCTION_ENDPOINT_DENYLIST_REQUIRED"
    }
  }
}

output "staging_contract" {
  sensitive = true
  value = {
    run_id              = var.run_id
    project_id          = neon_project.staging.id
    region              = neon_project.staging.region_id
    pooled_endpoint     = local.pooled_host
    unpooled_endpoint   = local.direct_host
    migration_endpoint = local.direct_host
  }
}
