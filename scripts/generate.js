import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PUZZLES_PATH = path.join(__dirname, '..', 'puzzles.json');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const OG_PATH = path.join(DIST_PATH, 'og');
const PUZZLE_PATH = path.join(DIST_PATH, 'puzzle');

const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');

async function generate() {
  if (!fs.existsSync(DIST_PATH)) {
    console.error('Dist folder not found. Run npm run build first.');
    process.exit(1);
  }

  const puzzles = JSON.parse(fs.readFileSync(MASTER_PUZZLES_PATH, 'utf8'));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const publishedPuzzles = {};
  const sitemapUrls = [];

  // Ensure directories exist
  if (!fs.existsSync(OG_PATH)) fs.mkdirSync(OG_PATH, { recursive: true });
  if (!fs.existsSync(PUZZLE_PATH)) fs.mkdirSync(PUZZLE_PATH, { recursive: true });

  const indexHtml = fs.readFileSync(path.join(DIST_PATH, 'index.html'), 'utf8');

  for (const [date, data] of Object.entries(puzzles)) {
    if (date > todayStr) continue;

    const puzzleDate = new Date(date + 'T00:00:00Z');
    if (puzzleDate < LAUNCH_DATE) continue;

    publishedPuzzles[date] = data;
    const puzzleNumber = Math.floor((puzzleDate.getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // 1. Generate OG Image
    const canvas = createCanvas(600, 315);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, 600, 315);

    // Draw Grid
    const tileSize = 50;
    const gap = 5;
    const boardPadding = 10;
    const boardSize = (tileSize * 4) + (gap * 3) + (boardPadding * 2);
    const startX = (600 - boardSize) / 2;
    const startY = (315 - boardSize) / 2;

    ctx.fillStyle = '#334155'; // slate-700
    ctx.beginPath();
    ctx.roundRect(startX, startY, boardSize, boardSize, 8);
    ctx.fill();

    const solution = data.solution;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = startX + boardPadding + c * (tileSize + gap);
        const y = startY + boardPadding + r * (tileSize + gap);

        ctx.fillStyle = '#475569'; // slate-600
        ctx.beginPath();
        ctx.roundRect(x, y, tileSize, tileSize, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(solution[r][c], x + tileSize / 2, y + tileSize / 2);
      }
    }

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WordWrap', 20, 40);

    ctx.fillStyle = '#60a5fa'; // blue-400
    ctx.fillText('Wrap', 20 + ctx.measureText('Word').width, 40);

    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = '16px sans-serif';
    ctx.fillText(`#${puzzleNumber} — ${date}`, 20, 70);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(OG_PATH, `${date}.png`), buffer);

    // 2. Generate HTML Shell
    const dateLabel = puzzleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const title = `WordWrap #${puzzleNumber} (${dateLabel}) — Daily Word Grid Puzzle Game | casualga.me`;
    const description = "Shift rows and columns to spell 4 words across and 4 words down. A new challenge every day.";
    const url = `https://casualga.me/${date}`;
    const imageUrl = `https://casualga.me/og/${date}.png`;

    let shellHtml = indexHtml;
    const metaTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${imageUrl}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${imageUrl}" />
    <link rel="canonical" href="${url}" />
    `;

    shellHtml = shellHtml.replace('</head>', `${metaTags}</head>`);

    const dateDir = path.join(DIST_PATH, date);
    if (!fs.existsSync(dateDir)) fs.mkdirSync(dateDir, { recursive: true });
    fs.writeFileSync(path.join(dateDir, 'index.html'), shellHtml);

    sitemapUrls.push(url);
  }

  // 3. Write filtered puzzles.json
  fs.writeFileSync(path.join(DIST_PATH, 'puzzles.json'), JSON.stringify(publishedPuzzles));

  // 4. Write sitemap.xml
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://casualga.me/</loc></url>
  ${sitemapUrls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(DIST_PATH, 'sitemap.xml'), sitemap);

  console.log('Generation complete!');
}

generate();
