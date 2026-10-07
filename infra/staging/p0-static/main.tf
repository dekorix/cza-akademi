terraform {
  required_version = "= 1.12.0"
}

locals {
  gate             = "P0-STATIC"
  mutation_surface = 0
  provider_count   = 0
}

output "p0_contract" {
  value = {
    gate                        = local.gate
    provider_mutation_forbidden = true
    mutation_surface            = local.mutation_surface
    provider_count              = local.provider_count
  }
}
