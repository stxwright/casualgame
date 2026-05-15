import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Must match the GitHub Pages repo sub-path.
  // For local dev, Vite respects this too so all asset/puzzle URLs stay consistent.
  base: '/wordwrap/',
  server: {
    host: true
  }
})