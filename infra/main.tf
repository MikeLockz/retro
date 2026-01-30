terraform {
  required_version = ">= 1.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# -----------------------------------------------------------------------------
# 1. SIGNALING WORKER WITH DURABLE OBJECTS
# -----------------------------------------------------------------------------

resource "cloudflare_workers_script" "signaling_worker" {
  account_id = var.cloudflare_account_id
  name       = "retro-signaling-server"
  content    = file("${path.module}/worker/dist/index.js")
  module     = true

  # Durable Object migration
  durable_object_namespace_binding {
    name         = "SIGNALING_ROOM"
    class_name   = "SignalingRoom"
  }
}

# Route the worker to a subdomain (requires a zone)
resource "cloudflare_worker_route" "signaling_route" {
  count       = var.cloudflare_zone_id != "" ? 1 : 0
  zone_id     = var.cloudflare_zone_id
  pattern     = "signaling.${var.domain}/*"
  script_name = cloudflare_workers_script.signaling_worker.name
}

# Alternative: Use workers.dev subdomain (no custom domain required)
resource "cloudflare_workers_domain" "signaling_domain" {
  count      = var.cloudflare_zone_id == "" ? 1 : 0
  account_id = var.cloudflare_account_id
  hostname   = "retro-signaling.${var.cloudflare_account_id}.workers.dev"
  service    = cloudflare_workers_script.signaling_worker.name
}

# -----------------------------------------------------------------------------
# 2. CLOUDFLARE PAGES (STATIC FRONTEND)
# -----------------------------------------------------------------------------

resource "cloudflare_pages_project" "retro_frontend" {
  account_id        = var.cloudflare_account_id
  name              = "retro-board"
  production_branch = "main"

  source {
    type = "github"
    config {
      owner                         = var.github_owner
      repo_name                     = var.github_repo
      production_branch             = "main"
      deployments_enabled           = true
      pr_comments_enabled           = true
      production_deployment_enabled = true
    }
  }

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = ""
  }

  deployment_configs {
    production {
      environment_variables = {
        VITE_SIGNALING_URL = local.signaling_url
      }
    }
    preview {
      environment_variables = {
        VITE_SIGNALING_URL = local.signaling_url
      }
    }
  }
}

# -----------------------------------------------------------------------------
# LOCAL VALUES
# -----------------------------------------------------------------------------

locals {
  signaling_url = var.cloudflare_zone_id != "" ? "wss://signaling.${var.domain}" : "wss://retro-signaling.${var.cloudflare_account_id}.workers.dev"
}
