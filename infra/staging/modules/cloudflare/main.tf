terraform {
  required_providers {
    cloudflare = {
      source = "cloudflare/cloudflare"
    }
  }
}

locals {
  resource_name = "cza-f3-${lower(var.run_id)}"
  worker_files = {
    "worker.mjs" = {
      content_file = "${path.module}/../../worker/src/worker.mjs"
      content_type = "application/javascript+module"
    }
    "canonical-edge.mjs" = {
      content_file = "${path.module}/../../worker/src/canonical-edge.mjs"
      content_type = "application/javascript+module"
    }
  }
}

resource "cloudflare_zero_trust_access_policy" "educator_mfa" {
  account_id       = var.account_id
  name             = "${local.resource_name}-educator-mfa"
  decision         = "allow"
  session_duration = "30m"
  include = [{
    email_domain = { domain = var.educator_email_domain }
  }]
  require = [{
    login_method = { id = var.access_identity_provider_id }
  }]
  mfa_config = {
    allowed_authenticators = ["biometrics", "security_key", "totp"]
    mfa_disabled           = false
    session_duration       = "30m"
  }
}

resource "cloudflare_zero_trust_access_application" "phase2" {
  account_id                 = var.account_id
  name                       = local.resource_name
  domain                     = var.public_authority
  type                       = "self_hosted"
  session_duration           = "30m"
  http_only_cookie_attribute = true
  same_site_cookie_attribute = "strict"
  enable_binding_cookie      = true
  options_preflight_bypass   = false
  policies = [{
    id         = cloudflare_zero_trust_access_policy.educator_mfa.id
    precedence = 1
  }]
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "origin" {
  account_id = var.account_id
  name       = local.resource_name
  config_src = "cloudflare"
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "origin" {
  account_id = var.account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.origin.id
  config = {
    ingress = [
      {
        hostname = var.transport_authority
        service  = var.origin_service_url
        origin_request = {
          http_host_header = var.origin_service_authority
        }
      },
      { service = "http_status:404" },
    ]
  }
}

resource "cloudflare_ruleset" "request_firewall" {
  zone_id     = var.zone_id
  name        = "${local.resource_name}-request-firewall"
  description = "Fail closed before the Worker sees a merged Headers view"
  kind        = "zone"
  phase       = "http_request_firewall_custom"
  rules = [{
    ref         = "cza_v4_reject_truncated_or_duplicate_security_headers"
    action      = "block"
    description = "Reject truncated, duplicate Content-Type, and client-injected trust headers"
    expression  = "http.request.headers.truncated or len(http.request.headers[\"content-type\"]) gt 1 or any(http.request.headers.names[*] matches \"^x-cza-\")"
  }]
}

resource "cloudflare_ruleset" "trusted_headers" {
  zone_id     = var.zone_id
  name        = "${local.resource_name}-trusted-headers"
  description = "Remove spoofable identity headers and emit edge-owned canonical inputs"
  kind        = "zone"
  phase       = "http_request_late_transform"
  rules = [{
    ref         = "cza_v4_edge_owned_headers"
    action      = "rewrite"
    description = "Overwrite the complete-header marker and raw target before Worker routing"
    expression  = "http.host eq \"${var.public_authority}\" and starts_with(http.request.uri.path, \"/phase2\")"
    action_parameters = {
      headers = {
        "x-cza-edge-policy-version" = { operation = "set", value = "CZA-EDGE-POLICY-V4" }
        "x-cza-edge-header-state"   = { operation = "set", value = "complete" }
        "x-cza-edge-raw-target"     = { operation = "set", expression = "concat(raw.http.request.uri.path, if(len(raw.http.request.uri.query) gt 0, concat(\"?\", raw.http.request.uri.query), \"\"))" }
        "x-forwarded-for"           = { operation = "remove" }
        "x-real-ip"                 = { operation = "remove" }
        "true-client-ip"            = { operation = "remove" }
        "forwarded"                 = { operation = "remove" }
      }
    }
  }]
}

resource "cloudflare_workers_script" "signer" {
  account_id          = var.account_id
  script_name         = local.resource_name
  main_module         = "worker.mjs"
  compatibility_date  = "2026-09-15"
  compatibility_flags = ["nodejs_compat"]
  files               = local.worker_files
  bindings = [
    { name = "PUBLIC_AUTHORITY", type = "plain_text", text = var.public_authority },
    { name = "TRANSPORT_AUTHORITY", type = "plain_text", text = var.transport_authority },
    { name = "ORIGIN_SERVICE_AUTHORITY", type = "plain_text", text = var.origin_service_authority },
    { name = "ACCESS_AUDIENCE", type = "plain_text", text = var.access_audience },
    { name = "HMAC_KEY_ID", type = "plain_text", text = var.hmac_key_id },
    { name = "HMAC_SECRET", type = "secret_text", text = var.hmac_secret },
    { name = "IP_HASH_KEY", type = "secret_text", text = var.ip_hash_key },
  ]
}

resource "cloudflare_workers_route" "public" {
  zone_id = var.zone_id
  pattern = "${var.public_authority}/phase2*"
  script  = cloudflare_workers_script.signer.script_name
}

resource "cloudflare_dns_record" "transport" {
  zone_id = var.zone_id
  name    = var.transport_authority
  content = "${cloudflare_zero_trust_tunnel_cloudflared.origin.id}.cfargotunnel.com"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

output "tunnel_id" {
  value     = cloudflare_zero_trust_tunnel_cloudflared.origin.id
  sensitive = true
}
