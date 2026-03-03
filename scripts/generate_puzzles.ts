import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const gridsPath = path.join(__dirname, 'data', 'grids.json');
const outputDir = path.join(__dirname, '..', 'data', 'puzzles');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// A simple seeded RNG (Mulberry32)
function seededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Simple string hasher for seeding
function xmur3(str: string) {
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

function shuffleArray<T>(array: T[], seedStr: string): T[] {
  const rng = seededRandom(xmur3(seedStr)());
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function generateTwoMoveScramble(dateStr: string) {
  const rng = seededRandom(xmur3(dateStr)());
  const moves = [];
  const colIdx = Math.floor(rng() * 4);
  const rowIdx = Math.floor(rng() * 4);
  const colDir = rng() > 0.5 ? 1 : -1;
  const rowDir = rng() > 0.5 ? 1 : -1;

  const colMove = { type: 'col', idx: colIdx, dir: colDir };
  const rowMove = { type: 'row', idx: rowIdx, dir: rowDir };

  // Randomize the order: Col->Row or Row->Col
  if (rng() > 0.5) {
    moves.push(colMove, rowMove);
  } else {
    moves.push(rowMove, colMove);
  }
  return moves;
}

async function generatePuzzles() {
  const rawGrids = JSON.parse(fs.readFileSync(gridsPath, 'utf8'));

  // Use a constant seed to ensure the shuffle is ALWAYS the same
  const shuffledGrids = shuffleArray([...rawGrids], "wordwrap-v1-stable-shuffle");

  // Define a fixed Epoch (LAUNCH_DATE in App.tsx)
  const epoch = new Date('2026-02-14T00:00:00Z').getTime();
  const msInDay = 24 * 60 * 60 * 1000;

  // Generate for 30 days from launch for testing
  const countToGenerate = 30;

  for (let i = 0; i < countToGenerate; i++) {
    const puzzleDate = new Date(epoch + (i * msInDay));
    const dateStr = puzzleDate.toISOString().split('T')[0];

    // Calculate days since epoch to pick the grid deterministically
    // Note: using the same epoch as launch date for puzzle selection logic consistency if needed,
    // but the script used 2026-01-01 as epoch. I should stick to one.
    // Let's see what upload_puzzles.ts used.
    // It used: const epoch = new Date('2026-01-01T00:00:00Z').getTime();
    const selectionEpoch = new Date('2026-01-01T00:00:00Z').getTime();
    const daysSinceSelectionEpoch = Math.floor((puzzleDate.getTime() - selectionEpoch) / msInDay);
    const selection = shuffledGrids[daysSinceSelectionEpoch % shuffledGrids.length];

    const scrambleMoves = generateTwoMoveScramble(dateStr);

    const puzzleData = {
      solution: selection,
      scrambleMoves: scrambleMoves,
      date: dateStr,
      puzzleNumber: i + 1
    };

    const filePath = path.join(outputDir, `${dateStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(puzzleData, null, 2));

    if (i % 100 === 0) {
      console.log(`Generated ${i} puzzles...`);
    }
  }

  console.log(`Success! Generated ${countToGenerate} puzzles in ${outputDir}`);
}

generatePuzzles().catch(console.error);
