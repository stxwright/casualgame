import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Must match the GitHub Pages repo sub-path.
  // For local dev, Vite respects this too so all asset/puzzle URLs stay consistent.
  base: '/casualgame/',
  server: {
    host: true
  }
})