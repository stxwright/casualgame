import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function seoPlugin() {
  // SEO constants
  const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');
  const SITE_URL = 'https://casualga.me/';

  return {
    name: 'seo-plugin',
    transformIndexHtml(html) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const puzzleNumber = Math.floor((new Date(dateStr + 'T00:00:00Z').getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const formattedDate = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const title = `WordWrap #${puzzleNumber} (${formattedDate}) — Daily Word Grid Puzzle Game | casualga.me`;
      const description = "Shift rows and columns to arrange letters into four words across and four words down in this daily word puzzle. Challenge yourself with a new Wordwrap grid every day!";

      const structuredData = {
        "@context": "https://schema.org",
        "@type": "VideoGame",
        "name": "WordWrap",
        "description": description,
        "genre": "Puzzle Game",
        "url": SITE_URL,
        "applicationCategory": "Game",
        "operatingSystem": "Web",
        "author": {
          "@type": "Organization",
          "name": "casualga.me"
        },
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD"
        }
      };

      const howToData = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "name": "How to play WordWrap",
        "step": [
          {
            "@type": "HowToStep",
            "text": "Shift rows and columns to arrange letters into 4 words across and 4 words down."
          },
          {
            "@type": "HowToStep",
            "text": "Each attempt consists of 2 moves. You have 6 attempts total."
          },
          {
            "@type": "HowToStep",
            "text": "Correct moves are marked green, partial moves yellow, and incorrect moves red."
          }
        ]
      };

      const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${SITE_URL}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${SITE_URL}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${SITE_URL}og-image.png" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${SITE_URL}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${SITE_URL}og-image.png" />

    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    <script type="application/ld+json">${JSON.stringify(howToData)}</script>
`;

      const noscriptShell = `
      <noscript>
        <div id="noscript-content" style="padding: 2rem; max-width: 600px; margin: 0 auto; font-family: sans-serif;">
          <h1>WordWrap #${puzzleNumber}</h1>
          <p>Today is ${formattedDate}.</p>
          <p>${description}</p>
          <h2>How to Play</h2>
          <ul>
            <li>Shift rows and columns to arrange letters into 4 words across and 4 words down.</li>
            <li>Each attempt consists of 2 moves. You have 6 attempts total.</li>
            <li>If the puzzle isn't solved after 2 moves, the grid resets for your next attempt.</li>
          </ul>
          <p><a href="/archive">Browse the Puzzle Archive</a></p>
        </div>
      </noscript>
`;

      // Replace existing title and description if any, otherwise prepend to head
      let newHtml = html
        .replace(/<title>.*?<\/title>/, '')
        .replace(/<meta name="description" content=".*?" \/>/, '')
        .replace('</head>', `${metaTags}</head>`)
        .replace('<div id="root"></div>', `<div id="root">${noscriptShell}</div>`);

      return newHtml;
    },
    closeBundle() {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const puzzles = [];
      const start = new Date(LAUNCH_DATE);
      const end = new Date(todayStr + 'T00:00:00Z');

      let current = new Date(end);
      while (current >= start) {
        const dateStr = current.toISOString().slice(0, 10);
        const pNum = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        puzzles.push({ date: dateStr, number: pNum });
        current.setDate(current.getDate() - 1);
      }

      // Generate Archive HTML
      const archiveDir = path.resolve(__dirname, 'dist/archive');
      if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });

      const archiveLinks = puzzles.map(p => {
        const url = p.date === todayStr ? '/' : `/?puzzle=${p.date}`;
        const label = new Date(p.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `<li><a href="${url}">Puzzle #${p.number} (${label})</a></li>`;
      }).join('\n            ');

      const archiveStructuredData = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "WordWrap Puzzle Archive",
        "description": "Browse and play past WordWrap puzzles.",
        "url": `${SITE_URL}archive`,
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": puzzles.map((p, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "url": `${SITE_URL}${p.date === todayStr ? '' : `?puzzle=${p.date}`}`
          }))
        }
      };

      const archiveHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Puzzle Archive — WordWrap | casualga.me</title>
    <meta name="description" content="Play past WordWrap puzzles from the archive. Challenge yourself with daily word grid puzzles.">
    <link rel="canonical" href="${SITE_URL}archive">
    <script type="application/ld+json">${JSON.stringify(archiveStructuredData)}</script>
    <style>
        body { background-color: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; margin: 0; padding: 2rem; }
        .container { max-width: 600px; margin: 0 auto; }
        h1 { color: #fff; margin-bottom: 0.5rem; }
        .back-link { display: inline-block; margin-bottom: 2rem; color: #60a5fa; text-decoration: none; font-weight: bold; }
        .back-link:hover { text-decoration: underline; }
        ul { list-style: none; padding: 0; }
        li { margin-bottom: 0.75rem; border-bottom: 1px solid #1e293b; padding-bottom: 0.75rem; }
        a { color: #fff; text-decoration: none; font-weight: 500; display: block; }
        a:hover { color: #60a5fa; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/" class="back-link">← Back to today's puzzle</a>
        <h1>Puzzle Archive</h1>
        <p>Browse and play past WordWrap puzzles.</p>
        <ul>
            ${archiveLinks}
        </ul>
    </div>
</body>
</html>`;

      fs.writeFileSync(path.resolve(archiveDir, 'index.html'), archiveHtml);
      console.log('Generated dist/archive/index.html');

      const sitemapPath = path.resolve(__dirname, 'dist/sitemap.xml');
      const nowSitemap = new Date().toISOString().slice(0, 10);
      const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${nowSitemap}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}archive</loc>
    <lastmod>${nowSitemap}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;
      fs.writeFileSync(sitemapPath, sitemapContent);
      console.log(`Generated dist/sitemap.xml with lastmod ${nowSitemap}`);
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    seoPlugin()
  ],
  base: './',
  server: {
    host: true
  }
})
