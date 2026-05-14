import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUZZLES_PATH = path.join(__dirname, '..', 'puzzles.json');

const puzzles = JSON.parse(fs.readFileSync(PUZZLES_PATH, 'utf8'));

// Sort dates to maintain sequential puzzle order
const sortedDates = Object.keys(puzzles).sort((a, b) => a.localeCompare(b));

const newPuzzles = sortedDates.map(date => puzzles[date]);

fs.writeFileSync(PUZZLES_PATH, JSON.stringify(newPuzzles, null, 2));

console.log(`Converted ${newPuzzles.length} puzzles to array format.`);
