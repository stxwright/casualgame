import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';
import { LAUNCH_DATE, getPuzzleNumber, formatDate } from '../src/dateUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PUZZLES_PATH = path.join(__dirname, '..', 'puzzles.json');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const OG_PATH = path.join(DIST_PATH, 'og');

const SITE_URL = process.env.VITE_SITE_URL || 'https://casualga.me/';

function shiftArray(arr, dir) {
  const newArr = [...arr];
  if (dir === 1) newArr.unshift(newArr.pop());
  else newArr.push(newArr.shift());
  return newArr;
}

function shiftColumn(currentGrid, colIdx, dir) {
  const newGrid = currentGrid.map(row => [...row]);
  const col = newGrid.map(row => row[colIdx]);
  const shiftedCol = shiftArray(col, dir);
  for (let i = 0; i < 4; i++) newGrid[i][colIdx] = shiftedCol[i];
  return newGrid;
}

function drawArrow(ctx, x, y, size, dir) {
  ctx.save();
  ctx.translate(x, y);
  if (dir === 'up') ctx.rotate(0);
  if (dir === 'right') ctx.rotate(Math.PI / 2);
  if (dir === 'down') ctx.rotate(Math.PI);
  if (dir === 'left') ctx.rotate(-Math.PI / 2);

  ctx.beginPath();
  ctx.moveTo(0, -size / 2.5);
  ctx.lineTo(size / 2.5, size / 4);
  ctx.lineTo(-size / 2.5, size / 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function generate() {
  if (!fs.existsSync(DIST_PATH)) {
    console.error('Dist folder not found. Run npm run build first.');
    process.exit(1);
  }

  const puzzles = JSON.parse(fs.readFileSync(MASTER_PUZZLES_PATH, 'utf8'));
  const now = new Date();
  // We include any puzzle that will be "today" within the next 24 hours.
  // This ensures that when the daily cron runs at 09:00 UTC, it includes
  // the puzzle for the next calendar day (which starts at 10:00 UTC in GMT+14).
  const publicationBuffer = 24 * 60 * 60 * 1000;
  const latestDate = new Date(now.getTime() + publicationBuffer);
  const latestStr = latestDate.toISOString().split('T')[0];

  const publishedPuzzles = {};
  const sitemapEntries = [];
  const archiveLinks = [];

  if (!fs.existsSync(OG_PATH)) fs.mkdirSync(OG_PATH, { recursive: true });

  const indexHtml = fs.readFileSync(path.join(DIST_PATH, 'index.html'), 'utf8');

  // Sort puzzles by date descending for archive display
  const sortedDates = Object.keys(puzzles).sort((a, b) => b.localeCompare(a));

  for (const date of sortedDates) {
    const data = puzzles[date];
    if (date > latestStr) continue;

    const puzzleDate = new Date(date + 'T00:00:00Z');
    if (puzzleDate < LAUNCH_DATE) continue;

    publishedPuzzles[date] = data;
    const puzzleNumber = getPuzzleNumber(puzzleDate);

    // SCRAMBLE THE GRID FOR OG IMAGE
    let scrambledGrid = data.solution.map(row => row.split(''));
    data.scrambleMoves.forEach(move => {
      if (move.type === 'row') {
        scrambledGrid[move.idx] = shiftArray(scrambledGrid[move.idx], move.dir);
      } else {
        scrambledGrid = shiftColumn(scrambledGrid, move.idx, move.dir);
      }
    });

    // 1. Generate OG Image
    const canvas = createCanvas(600, 315);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, 600, 315);

    // Draw Grid
    const tileSize = 45;
    const gap = 6;
    const boardPadding = 12;
    const boardSize = (tileSize * 4) + (gap * 3) + (boardPadding * 2);
    const startX = 320;
    const startY = (315 - boardSize) / 2;

    ctx.fillStyle = '#334155'; // slate-700
    ctx.beginPath();
    ctx.roundRect(startX, startY, boardSize, boardSize, 12);
    ctx.fill();

    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const x = startX + boardPadding + c * (tileSize + gap);
        const y = startY + boardPadding + r * (tileSize + gap);

        ctx.fillStyle = '#475569'; // slate-600
        ctx.beginPath();
        ctx.roundRect(x, y, tileSize, tileSize, 6);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(scrambledGrid[r][c], x + tileSize / 2, y + tileSize / 2);
      }
    }

    // DRAW SHIFTERS
    ctx.fillStyle = '#475569';
    const btnSize = 18;
    for (let i = 0; i < 4; i++) {
      const colX = startX + boardPadding + i * (tileSize + gap) + tileSize / 2;
      const rowY = startY + boardPadding + i * (tileSize + gap) + tileSize / 2;

      // Top
      drawArrow(ctx, colX, startY, btnSize, 'up');
      // Bottom
      drawArrow(ctx, colX, startY + boardSize, btnSize, 'down');
      // Left
      drawArrow(ctx, startX, rowY, btnSize, 'left');
      // Right
      drawArrow(ctx, startX + boardSize, rowY, btnSize, 'right');
    }

    // Header Branding
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Word', 40, 140);
    const wordWidth = ctx.measureText('Word').width;
    ctx.fillStyle = '#60a5fa'; // blue-400
    ctx.fillText('Wrap', 40 + wordWidth, 140);

    ctx.fillStyle = '#94a3b8'; // slate-400
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`#${puzzleNumber}`, 40, 180);
    ctx.font = '16px sans-serif';
    ctx.fillText(date, 40, 210);

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(OG_PATH, `${date}.png`), buffer);

    // 2. Generate HTML Shell
    const dateLabel = formatDate(puzzleDate);
    const title = `WordWrap #${puzzleNumber} (${dateLabel}) — Daily Word Grid Puzzle Game | casualga.me`;
    const description = "Shift rows and columns to spell 4 words across and 4 words down. A new challenge every day.";
    const url = `${SITE_URL}${date}`;
    const imageUrl = `${SITE_URL}og/${date}.png`;

    // Ensure absolute URLs are correct by replacing the production base with the environment-specific SITE_URL
    let shellHtml = indexHtml.split('https://casualga.me/').join(SITE_URL);

    // Update title and description for this specific date
    shellHtml = shellHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    shellHtml = shellHtml.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${title}" />`);
    shellHtml = shellHtml.replace(/<meta name="twitter:title" content=".*?" \/>/g, `<meta name="twitter:title" content="${title}" />`);

    shellHtml = shellHtml.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`);
    shellHtml = shellHtml.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${description}" />`);
    shellHtml = shellHtml.replace(/<meta name="twitter:description" content=".*?" \/>/g, `<meta name="twitter:description" content="${description}" />`);

    // Ensure the canonical and URL tags point to the specific puzzle route
    shellHtml = shellHtml.replace(/<link rel="canonical" href=".*?" \/>/, `<link rel="canonical" href="${url}" />`);
    shellHtml = shellHtml.replace(/<meta property="og:url" content=".*?" \/>/g, `<meta property="og:url" content="${url}" />`);
    shellHtml = shellHtml.replace(/<meta name="twitter:url" content=".*?" \/>/g, `<meta name="twitter:url" content="${url}" />`);

    // Ensure OG image points to the correct date-specific PNG
    shellHtml = shellHtml.replace(/<meta property="og:image" content=".*?" \/>/g, `<meta property="og:image" content="${imageUrl}" />`);
    shellHtml = shellHtml.replace(/<meta name="twitter:image" content=".*?" \/>/g, `<meta name="twitter:image" content="${imageUrl}" />`);

    const dateDir = path.join(DIST_PATH, date);
    if (!fs.existsSync(dateDir)) fs.mkdirSync(dateDir, { recursive: true });
    fs.writeFileSync(path.join(dateDir, 'index.html'), shellHtml);

    sitemapEntries.push({ url, lastmod: date });
    archiveLinks.push({ url: `/${date}`, title: `WordWrap #${puzzleNumber} (${dateLabel})` });
  }

  // 3. Write filtered puzzles.json (chronological order)
  const chronologicalPuzzles = {};
  Object.keys(publishedPuzzles).sort().forEach(date => {
    chronologicalPuzzles[date] = publishedPuzzles[date];
  });
  fs.writeFileSync(path.join(DIST_PATH, 'puzzles.json'), JSON.stringify(chronologicalPuzzles));

  // 4. Generate Archive Page
  const archiveTitle = "Archive — WordWrap Daily Word Grid Puzzle Game";
  const archiveDescription = "Browse the full history of WordWrap daily puzzles. Play any puzzle from our archive!";
  const archiveUrl = `${SITE_URL}archive`;

  let archiveHtml = indexHtml.split('https://casualga.me/').join(SITE_URL);
  archiveHtml = archiveHtml.replace(/<title>.*?<\/title>/, `<title>${archiveTitle}</title>`);
  archiveHtml = archiveHtml.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${archiveDescription}" />`);
  archiveHtml = archiveHtml.replace(/<meta property="og:title" content=".*?" \/>/g, `<meta property="og:title" content="${archiveTitle}" />`);
  archiveHtml = archiveHtml.replace(/<meta property="og:description" content=".*?" \/>/g, `<meta property="og:description" content="${archiveDescription}" />`);
  archiveHtml = archiveHtml.replace(/<meta property="og:url" content=".*?" \/>/g, `<meta property="og:url" content="${archiveUrl}" />`);
  archiveHtml = archiveHtml.replace(/<meta name="twitter:title" content=".*?" \/>/g, `<meta name="twitter:title" content="${archiveTitle}" />`);
  archiveHtml = archiveHtml.replace(/<meta name="twitter:description" content=".*?" \/>/g, `<meta name="twitter:description" content="${archiveDescription}" />`);
  archiveHtml = archiveHtml.replace(/<meta name="twitter:url" content=".*?" \/>/g, `<meta name="twitter:url" content="${archiveUrl}" />`);

  // Add a hidden list of links for SEO
  const linksHtml = `
    <div id="seo-archive" style="display:none">
      <h1>WordWrap Puzzle Archive</h1>
      <ul>
        ${archiveLinks.map(link => `<li><a href="${link.url}">${link.title}</a></li>`).join('\n        ')}
      </ul>
    </div>
  `;
  // More robust replacement for body tag
  archiveHtml = archiveHtml.replace(/(<body[^>]*>)/i, `$1${linksHtml}`);

  const archiveDir = path.join(DIST_PATH, 'archive');
  if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(path.join(archiveDir, 'index.html'), archiveHtml);

  // 5. Write sitemap.xml
  const todayIso = now.toISOString().split('T')[0];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${archiveUrl}</loc>
    <lastmod>${todayIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  ${sitemapEntries.map(entry => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(DIST_PATH, 'sitemap.xml'), sitemap);

  console.log('Generation complete!');
}

generate();
