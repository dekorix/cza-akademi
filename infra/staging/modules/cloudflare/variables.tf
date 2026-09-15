variable "account_id" { type = string }
variable "zone_id" { type = string }
variable "run_id" { type = string }
variable "public_authority" { type = string }
variable "transport_authority" { type = string }
variable "origin_service_authority" { type = string }
variable "origin_service_url" { type = string }
variable "access_audience" { type = string }
variable "access_identity_provider_id" { type = string }
variable "educator_email_domain" { type = string }
variable "hmac_key_id" { type = string }
variable "hmac_secret" {
  type      = string
  sensitive = true
}
variable "ip_hash_key" {
  type      = string
  sensitive = true
}
