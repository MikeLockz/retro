output "signaling_url" {
  description = "WebSocket URL for the signaling server"
  value       = local.signaling_url
}

output "pages_url" {
  description = "Cloudflare Pages deployment URL"
  value       = "https://${cloudflare_pages_project.retro_frontend.subdomain}"
}

output "worker_name" {
  description = "Deployed worker script name"
  value       = cloudflare_workers_script.signaling_worker.name
}
