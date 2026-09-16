terraform {
  required_version = "= 1.12.0"

  required_providers {
    neon = {
      source  = "terraform-community-providers/neon"
      version = "= 0.1.15"
    }
  }
}

provider "neon" {
  api_key = var.neon_api_key
}
