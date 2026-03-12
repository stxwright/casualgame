import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { LAUNCH_DATE, getPuzzleNumber, formatDate } from './src/dateUtils'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SEO constants
const SITE_URL = process.env.VITE_SITE_URL || 'https://casualga.me/';

function seoPlugin() {
  return {
    name: 'seo-plugin',
    transformIndexHtml(html) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const puzzleNumber = getPuzzleNumber(dateStr);
      const dateLabel = formatDate(dateStr);

      const title = `WordWrap #${puzzleNumber} (${dateLabel}) — Daily Word Grid Puzzle Game | casualga.me`;
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
    <meta property="og:image" content="${SITE_URL}og/${dateStr}.png" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${SITE_URL}" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${SITE_URL}og/${dateStr}.png" />

    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    <script type="application/ld+json">${JSON.stringify(howToData)}</script>
`;

      const staticShell = `
      <div id="seo-content" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;">
        <h1>WordWrap #${puzzleNumber}</h1>
        <p>Today is ${formatDate(dateStr, { month: 'long' })}.</p>
        <p>${description}</p>
        <h2>How to Play</h2>
        <ul>
          <li>Shift rows and columns to arrange letters into 4 words across and 4 words down.</li>
          <li>Each attempt consists of 2 moves. You have 6 attempts total.</li>
          <li>If the puzzle isn't solved after 2 moves, the grid resets for your next attempt.</li>
        </ul>
        <h3>Move Feedback</h3>
        <ul>
          <li><strong>Correct:</strong> This move is part of the solution.</li>
          <li><strong>Partial:</strong> Right row/column, wrong direction.</li>
          <li><strong>Incorrect:</strong> This row/column does not need shifting.</li>
        </ul>
      </div>
`;

      // Replace existing title and description if any, otherwise prepend to head
      let newHtml = html
        .replace(/<title>.*?<\/title>/, '')
        .replace(/<meta name="description" content=".*?" \/>/, '')
        .replace('</head>', `${metaTags}</head>`)
        .replace('<div id="root"></div>', `<div id="root">${staticShell}</div>`);

      return newHtml;
    },
    closeBundle() {
      const sitemapPath = path.resolve(__dirname, 'dist/sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        let sitemap = fs.readFileSync(sitemapPath, 'utf-8');
        sitemap = sitemap.replace(/<lastmod>.*?<\/lastmod>/g, `<lastmod>${dateStr}</lastmod>`);
        fs.writeFileSync(sitemapPath, sitemap);
        console.log(`Updated sitemap.xml lastmod to ${dateStr}`);
      }
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
  base: '/',
  server: {
    host: true
  }
})
