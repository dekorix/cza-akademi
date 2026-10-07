variable "p0c_attestation_sha256" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^[0-9a-f]{64}$", var.p0c_attestation_sha256))
    error_message = "P0C_ATTESTATION_REQUIRED"
  }
}

variable "run_id" {
  type = string
  validation {
    condition     = can(regex("^[0-9A-HJKMNP-TV-Z]{26}$", var.run_id))
    error_message = "RUN_ID_MUST_BE_ULID"
  }
}

variable "expires_at" { type = string }
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}
variable "neon_api_key" {
  type      = string
  sensitive = true
}
variable "cloudflare_account_id" { type = string }
variable "cloudflare_zone_id" { type = string }
variable "public_authority" { type = string }
variable "transport_authority" { type = string }
variable "origin_service_authority" { type = string }
variable "access_audience" { type = string }
variable "access_identity_provider_id" { type = string }
variable "educator_email_domain" { type = string }
variable "staging_cidr_allowlist" { type = list(string) }
variable "origin_service_url" { type = string }
variable "hmac_key_id" { type = string }
variable "hmac_secret" {
  type      = string
  sensitive = true
}
variable "ip_hash_key" {
  type      = string
  sensitive = true
}

variable "production_endpoint_sha256_denylist" {
  type      = set(string)
  sensitive = true
}
