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
    {
      name: 'copy-404',
      closeBundle() {
        const distPath = path.resolve(__dirname, 'dist');
        const indexPath = path.resolve(distPath, 'index.html');
        const fourOhFourPath = path.resolve(distPath, '404.html');
        if (fs.existsSync(indexPath)) {
          fs.copyFileSync(indexPath, fourOhFourPath);
          console.log('Copied index.html to 404.html for GitHub Pages SPA support');
        }
      }
    }
  ],
  // Must match the GitHub Pages repo sub-path.
  // For local dev, Vite respects this too so all asset/puzzle URLs stay consistent.
  base: '/casualgame/',
  server: {
    host: true
  }
})