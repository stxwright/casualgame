import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SEO constants
const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');
const SITE_URL = 'https://casualga.me/';
const DESCRIPTION = "Shift rows and columns to arrange letters into four words across and four words down in this daily word puzzle. Challenge yourself with a new Wordwrap grid every day!";

function getPuzzleInfo(date) {
  const dateStr = date.toISOString().slice(0, 10);
  const puzzleNumber = Math.floor((new Date(dateStr + 'T00:00:00Z').getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const formattedDate = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return { dateStr, puzzleNumber, formattedDate };
}

function generateSEOMetadata(puzzleInfo, isArchive = false) {
  const { puzzleNumber, formattedDate, dateStr } = puzzleInfo;
  const title = `WordWrap #${puzzleNumber} (${formattedDate}) — Daily Word Grid Puzzle Game | casualga.me`;
  const canonicalUrl = isArchive ? `${SITE_URL}archive/${dateStr}.html` : SITE_URL;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "WordWrap",
    "description": DESCRIPTION,
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

  return `
    <title>${title}</title>
    <meta name="description" content="${DESCRIPTION}" />
    <link rel="canonical" href="${canonicalUrl}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${DESCRIPTION}" />
    <meta property="og:image" content="${SITE_URL}og-image.png" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${canonicalUrl}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${DESCRIPTION}" />
    <meta property="twitter:image" content="${SITE_URL}og-image.png" />

    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    <script type="application/ld+json">${JSON.stringify(howToData)}</script>
    ${isArchive ? `<script>window.ARCHIVE_DATE = '${dateStr}';</script>` : ''}
`;
}

function generateStaticShell(puzzleInfo) {
  const { puzzleNumber, formattedDate } = puzzleInfo;
  return `
      <div id="seo-content" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;">
        <h1>WordWrap #${puzzleNumber}</h1>
        <p>Puzzle for ${formattedDate}.</p>
        <p>${DESCRIPTION}</p>
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
}

function seoPlugin() {
  return {
    name: 'seo-plugin',
    transformIndexHtml(html) {
      const puzzleInfo = getPuzzleInfo(new Date());
      const metaTags = generateSEOMetadata(puzzleInfo);
      const staticShell = generateStaticShell(puzzleInfo);

      return html
        .replace(/<title>.*?<\/title>/, '')
        .replace(/<meta name="description" content=".*?" \/>/, '')
        .replace('</head>', `${metaTags}</head>`)
        .replace('<div id="root"></div>', `<div id="root">${staticShell}</div>`);
    },
    closeBundle() {
      const distPath = path.resolve(__dirname, 'dist');
      const indexPath = path.resolve(distPath, 'index.html');
      const archiveDir = path.resolve(distPath, 'archive');

      if (!fs.existsSync(indexPath)) return;

      const indexHtml = fs.readFileSync(indexPath, 'utf-8');

      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sitemapEntries = [];

      let current = new Date(LAUNCH_DATE);
      while (current <= today) {
        const puzzleInfo = getPuzzleInfo(current);
        const { dateStr } = puzzleInfo;

        // Generate Archive Page
        const metaTags = generateSEOMetadata(puzzleInfo, true);
        const staticShell = generateStaticShell(puzzleInfo);

        // Let's use a clean approach for replacement in archive pages.
        const todayInfo = getPuzzleInfo(new Date());
        const todayMeta = generateSEOMetadata(todayInfo);
        const todayShell = generateStaticShell(todayInfo);

        const finalArchiveHtml = indexHtml
          .replace(todayMeta, metaTags)
          .replace(todayShell, staticShell);

        fs.writeFileSync(path.resolve(archiveDir, `${dateStr}.html`), finalArchiveHtml);

        // Add to sitemap
        sitemapEntries.push(`  <url>
    <loc>${SITE_URL}archive/${dateStr}.html</loc>
    <lastmod>${dateStr}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.8</priority>
  </url>`);

        current.setDate(current.getDate() + 1);
      }

      // Sitemap generation
      const sitemapPath = path.resolve(distPath, 'sitemap.xml');
      const now = new Date().toISOString().slice(0, 10);
      const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${sitemapEntries.join('\n')}
</urlset>`;

      fs.writeFileSync(sitemapPath, sitemapContent);
      console.log(`Generated archive pages and updated sitemap.xml`);
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
