import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');
const SITE_URL = 'https://casualga.me/';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

// Use the Firestore REST API to fetch data during build
// https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents/{collection}/{document_id}
const PROJECT_ID = 'casualgame-9b4f9';
const COLLECTION = 'puzzles';

async function fetchPuzzle(dateStr) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${COLLECTION}/${dateStr}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();

    // Convert Firestore REST format to simple JS object
    // Note: This needs to match the structure the app expects
    const fields = data.fields;
    return {
      date: dateStr,
      solution: fields.solution.arrayValue.values.map(v => v.stringValue),
      scrambleMoves: fields.scrambleMoves.arrayValue.values.map(v => ({
        type: v.mapValue.fields.type.stringValue,
        idx: parseInt(v.mapValue.fields.idx.integerValue),
        dir: parseInt(v.mapValue.fields.dir.integerValue)
      }))
    };
  } catch (e) {
    console.error(`Error fetching puzzle for ${dateStr}:`, e);
    return null;
  }
}

function getPuzzleNumber(dateStr) {
  return Math.floor((new Date(dateStr + 'T00:00:00Z').getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function generateSEO(dateStr, puzzleNumber, puzzleData, html) {
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
    <script>window.INITIAL_PUZZLE_DATA = ${JSON.stringify(puzzleData)};</script>
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

  const sitemapUrls = [SITE_URL];

  // Generate for all dates from LAUNCH_DATE to today
  const puzzles = [];
  let current = new Date(LAUNCH_DATE);
  while (current <= now) {
    puzzles.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  console.log(`Generating SSG for ${puzzles.length} puzzles from Firestore...`);

  for (const date of puzzles) {
    const puzzleData = await fetchPuzzle(date);
    if (!puzzleData) {
      console.warn(`Skipping ${date} - data not found in Firestore.`);
      continue;
    }

    const puzzleNumber = getPuzzleNumber(date);
    const puzzleHtml = generateSEO(date, puzzleNumber, puzzleData, indexHtml);
    const puzzleDir = path.resolve(DIST_DIR, date);

    if (!fs.existsSync(puzzleDir)) {
      fs.mkdirSync(puzzleDir);
    }
    fs.writeFileSync(path.resolve(puzzleDir, 'index.html'), puzzleHtml);
    sitemapUrls.push(`${SITE_URL}${date}`);

    if (date === todayStr) {
      // Update root index.html with today's baked data
      const rootHtml = generateSEO(null, puzzleNumber, puzzleData, indexHtml);
      fs.writeFileSync(path.resolve(DIST_DIR, 'index.html'), rootHtml);
    }
  }

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
