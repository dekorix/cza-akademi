locals {
  common_tags = {
    cza_environment = "staging-security-lab"
    cza_run_id      = var.run_id
    cza_expires_at  = var.expires_at
    cza_owner       = "security-engineering"
  }

  authorities_are_distinct = length(toset([
    var.public_authority,
    var.transport_authority,
    var.origin_service_authority,
  ])) == 3
}

module "neon" {
  source = "../modules/neon"

  run_id               = var.run_id
  allowed_ip_addresses = var.staging_cidr_allowlist
}

module "cloudflare" {
  source = "../modules/cloudflare"

  account_id                  = var.cloudflare_account_id
  zone_id                     = var.cloudflare_zone_id
  run_id                      = var.run_id
  public_authority            = var.public_authority
  transport_authority         = var.transport_authority
  origin_service_authority    = var.origin_service_authority
  origin_service_url          = var.origin_service_url
  access_audience             = var.access_audience
  access_identity_provider_id = var.access_identity_provider_id
  educator_email_domain       = var.educator_email_domain
  hmac_key_id                 = var.hmac_key_id
  hmac_secret                 = var.hmac_secret
  ip_hash_key                 = var.ip_hash_key
}

check "authority_separation" {
  assert {
    condition     = local.authorities_are_distinct
    error_message = "AUTHORITY_COLLISION"
  }
}

output "staging_contract" {
  sensitive = true
  value = {
    run_id                   = var.run_id
    project_id               = module.neon.project_id
    migrator_database_url    = module.neon.migrator_database_url
    runtime_database_url     = module.neon.runtime_database_url
    public_authority         = var.public_authority
    transport_authority      = var.transport_authority
    origin_service_authority = var.origin_service_authority
    tunnel_id                = module.cloudflare.tunnel_id
  }
}
