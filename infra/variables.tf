variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers and Pages permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (from dashboard URL)"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID (optional, for custom domain routing)"
  type        = string
  default     = ""
}

variable "domain" {
  description = "Custom domain name (optional, requires zone_id)"
  type        = string
  default     = ""
}

variable "github_owner" {
  description = "GitHub username or organization"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "retro"
}
