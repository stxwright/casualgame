import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');
const SITE_URL = 'https://casualga.me/';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const PUZZLES_SRC_DIR = path.resolve(__dirname, '..', 'data', 'puzzles');
const PUZZLES_DIST_DIR = path.resolve(DIST_DIR, 'puzzles');

function getPuzzleNumber(dateStr) {
  return Math.floor((new Date(dateStr + 'T00:00:00Z').getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function generateSEO(dateStr, puzzleNumber, html) {
  const title = `WordWrap #${puzzleNumber} — Daily Word Grid Puzzle Game | casualga.me`;
  const description = "Shift rows and columns to arrange letters into four words across and four words down in this daily word puzzle. Challenge yourself with a new Wordwrap grid every day!";
  const canonical = dateStr ? `${SITE_URL}${dateStr}` : SITE_URL;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "WordWrap",
    "description": description,
    "genre": "Puzzle Game",
    "url": canonical,
    "applicationCategory": "Game",
    "operatingSystem": "Web",
    "author": { "@type": "Organization", "name": "casualga.me" },
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  };

  const metaTags = `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${SITE_URL}og-image.png" />
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${canonical}" />
    <meta property="twitter:title" content="${title}" />
    <meta property="twitter:description" content="${description}" />
    <meta property="twitter:image" content="${SITE_URL}og-image.png" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
`;

  const staticShell = `
    <div id="seo-content" style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0;">
      <h1>WordWrap #${puzzleNumber}</h1>
      <p>${dateStr ? `Puzzle for ${new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.` : `Today's Puzzle.`}</p>
      <p>${description}</p>
      <h2>How to Play</h2>
      <ul>
        <li>Shift rows and columns to arrange letters into 4 words across and 4 words down.</li>
        <li>Each attempt consists of 2 moves. You have 6 attempts total.</li>
      </ul>
    </div>
`;

  return html
    .replace(/<title>.*?<\/title>/, '')
    .replace(/<meta name="description" content=".*?" \/>/, '')
    .replace('</head>', `${metaTags}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${staticShell}</div>`);
}

async function runSSG() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const indexHtml = fs.readFileSync(path.resolve(DIST_DIR, 'index.html'), 'utf-8');

  if (!fs.existsSync(PUZZLES_DIST_DIR)) {
    fs.mkdirSync(PUZZLES_DIST_DIR, { recursive: true });
  }

  const sitemapUrls = [SITE_URL];

  // Get all puzzles from data/puzzles
  const puzzles = fs.readdirSync(PUZZLES_SRC_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
    .filter(date => date <= todayStr)
    .sort();

  console.log(`Generating SSG for ${puzzles.length} puzzles...`);

  for (const date of puzzles) {
    const puzzleNumber = getPuzzleNumber(date);
    const puzzleHtml = generateSEO(date, puzzleNumber, indexHtml);
    const puzzleDir = path.resolve(DIST_DIR, date);

    if (!fs.existsSync(puzzleDir)) {
      fs.mkdirSync(puzzleDir);
    }
    fs.writeFileSync(path.resolve(puzzleDir, 'index.html'), puzzleHtml);

    // Copy JSON to dist/puzzles
    fs.copyFileSync(
      path.resolve(PUZZLES_SRC_DIR, `${date}.json`),
      path.resolve(PUZZLES_DIST_DIR, `${date}.json`)
    );

    sitemapUrls.push(`${SITE_URL}${date}`);
  }

  // Update root index.html for today
  const todayPuzzleNumber = getPuzzleNumber(todayStr);
  const rootHtml = generateSEO(null, todayPuzzleNumber, indexHtml);
  fs.writeFileSync(path.resolve(DIST_DIR, 'index.html'), rootHtml);

  // Generate sitemap.xml
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>daily</changefreq>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.resolve(DIST_DIR, 'sitemap.xml'), sitemap);

  console.log('SSG and Sitemap generation complete.');
}

runSSG().catch(console.error);
