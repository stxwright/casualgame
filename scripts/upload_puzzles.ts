import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use path.join to ensure correct file resolution regardless of where the script is run from
const serviceAccountPath = path.join(__dirname, 'service-account.json');
const gridsPath = path.join(__dirname, 'data', 'grids.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("Error: scripts/service-account.json not found!");
  console.error("Please download it from Firebase Console > Project Settings > Service Accounts.");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

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

async function uploadPuzzles() {
  const rawGrids = JSON.parse(fs.readFileSync(gridsPath, 'utf8'));
  
  // Use a constant seed to ensure the shuffle is ALWAYS the same every time we run the script
  const shuffledGrids = shuffleArray([...rawGrids], "wordwrap-v1-stable-shuffle");
  
  // Define a fixed Epoch (Start of 2026)
  const epoch = new Date('2026-01-01T00:00:00Z').getTime();
  const msInDay = 24 * 60 * 60 * 1000;

  // The range we want to update (from today for 365 days)
  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  
  const countToUpload = 365;

  for (let i = 0; i < countToUpload; i++) {
    const puzzleDate = new Date(startDate.getTime() + (i * msInDay));
    const dateStr = puzzleDate.toISOString().split('T')[0];
    
    // Calculate days since epoch to pick the grid deterministically
    const daysSinceEpoch = Math.floor((puzzleDate.getTime() - epoch) / msInDay);
    const selection = shuffledGrids[daysSinceEpoch % shuffledGrids.length];
    
    // Seed scramble moves with the date string
    const scrambleMoves = generateTwoMoveScramble(dateStr);
    
    console.log(`[${i+1}/${countToUpload}] Uploading ${dateStr}...`);
    
    await db.collection('puzzles').doc(dateStr).set({
      solution: selection,
      scrambleMoves: scrambleMoves,
      publishDate: admin.firestore.Timestamp.fromDate(puzzleDate)
    });
  }
  
  console.log("Success! Database updated deterministically.");
}

uploadPuzzles().catch(console.error);
