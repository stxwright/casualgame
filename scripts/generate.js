import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MASTER_PUZZLES_PATH = path.join(__dirname, '..', 'puzzles.json');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const OG_PATH = path.join(DIST_PATH, 'og');

const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');
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
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const publishedPuzzles = {};
  const sitemapUrls = [];

  if (!fs.existsSync(OG_PATH)) fs.mkdirSync(OG_PATH, { recursive: true });

  const indexHtml = fs.readFileSync(path.join(DIST_PATH, 'index.html'), 'utf8');

  for (const [date, data] of Object.entries(puzzles)) {
    if (date > todayStr) continue;

    const puzzleDate = new Date(date + 'T00:00:00Z');
    if (puzzleDate < LAUNCH_DATE) continue;

    publishedPuzzles[date] = data;
    const puzzleNumber = Math.floor((puzzleDate.getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;

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
    const dateLabel = puzzleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

    sitemapUrls.push(url);
  }

  // 3. Write filtered puzzles.json
  fs.writeFileSync(path.join(DIST_PATH, 'puzzles.json'), JSON.stringify(publishedPuzzles));

  // 4. Write sitemap.xml
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}</loc></url>
  ${sitemapUrls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(DIST_PATH, 'sitemap.xml'), sitemap);

  console.log('Generation complete!');
}

generate();
