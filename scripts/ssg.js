import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');
const SITE_URL = 'https://casualga.me/';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const GRIDS_PATH = path.resolve(__dirname, 'data', 'grids.json');
const PUZZLES_DIST_DIR = path.resolve(DIST_DIR, 'puzzles');

// DETERMINISTIC PUZZLE GENERATION LOGIC

// A simple seeded RNG (Mulberry32)
function seededRandom(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Simple string hasher for seeding
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3452271217);
    h = h << 13 | h >>> 19;
  }
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function shuffleArray(array, seedStr) {
  const rng = seededRandom(xmur3(seedStr)());
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function generateTwoMoveScramble(dateStr) {
  const rng = seededRandom(xmur3(dateStr)());
  const moves = [];
  const colIdx = Math.floor(rng() * 4);
  const rowIdx = Math.floor(rng() * 4);
  const colDir = rng() > 0.5 ? 1 : -1;
  const rowDir = rng() > 0.5 ? 1 : -1;

  const colMove = { type: 'col', idx: colIdx, dir: colDir };
  const rowMove = { type: 'row', idx: rowIdx, dir: rowDir };

  if (rng() > 0.5) {
    moves.push(colMove, rowMove);
  } else {
    moves.push(rowMove, colMove);
  }
  return moves;
}

const rawGrids = JSON.parse(fs.readFileSync(GRIDS_PATH, 'utf8'));
const shuffledGrids = shuffleArray([...rawGrids], "wordwrap-v1-stable-shuffle");
const selectionEpoch = new Date('2026-01-01T00:00:00Z').getTime();
const msInDay = 24 * 60 * 60 * 1000;

function getPuzzleData(dateStr) {
  const puzzleDate = new Date(dateStr + 'T12:00:00Z');
  const daysSinceSelectionEpoch = Math.floor((puzzleDate.getTime() - selectionEpoch) / msInDay);
  const selection = shuffledGrids[daysSinceSelectionEpoch % shuffledGrids.length];
  const scrambleMoves = generateTwoMoveScramble(dateStr);
  const puzzleNumber = Math.floor((puzzleDate.getTime() - LAUNCH_DATE.getTime()) / msInDay) + 1;

  return {
    date: dateStr,
    solution: selection,
    scrambleMoves: scrambleMoves,
    puzzleNumber: puzzleNumber
  };
}

// SSG LOGIC

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

  if (!fs.existsSync(PUZZLES_DIST_DIR)) {
    fs.mkdirSync(PUZZLES_DIST_DIR, { recursive: true });
  }

  const sitemapUrls = [SITE_URL];

  // Generate for all dates from LAUNCH_DATE to today
  const puzzles = [];
  let current = new Date(LAUNCH_DATE);
  while (current <= now) {
    puzzles.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  console.log(`Generating SSG for ${puzzles.length} puzzles from source grids...`);

  for (const date of puzzles) {
    const puzzleData = getPuzzleData(date);
    const puzzleNumber = puzzleData.puzzleNumber;
    const puzzleHtml = generateSEO(date, puzzleNumber, puzzleData, indexHtml);
    const puzzleDir = path.resolve(DIST_DIR, date);

    if (!fs.existsSync(puzzleDir)) {
      fs.mkdirSync(puzzleDir);
    }
    fs.writeFileSync(path.resolve(puzzleDir, 'index.html'), puzzleHtml);

    // Also write JSON for SPA navigation
    fs.writeFileSync(path.resolve(PUZZLES_DIST_DIR, `${date}.json`), JSON.stringify(puzzleData));

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

  console.log('SSG, JSON, and Sitemap generation complete.');
}

runSSG().catch(console.error);
