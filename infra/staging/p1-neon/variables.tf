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

variable "environment" {
  type    = string
  default = "staging"
  validation {
    condition     = var.environment == "staging"
    error_message = "NEON_STAGING_ONLY"
  }
}

variable "expires_at" {
  type = string
}

variable "neon_api_key" {
  type      = string
  sensitive = true
}

variable "production_endpoint_sha256_denylist" {
  type      = set(string)
  sensitive = true
  validation {
    condition = length(var.production_endpoint_sha256_denylist) > 0 && alltrue([
      for digest in var.production_endpoint_sha256_denylist : can(regex("^[0-9a-f]{64}$", digest))
    ])
    error_message = "PRODUCTION_ENDPOINT_DENYLIST_REQUIRED"
  }
}
