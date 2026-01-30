import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use VITE_BASE_PATH for GitHub Pages ('/retro/'), omit for Cloudflare Pages
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist'
  }
})
