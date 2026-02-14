
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: './.env' }); // Assuming run from project root

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function generateScrambleMoves(count: number) {
  const moves = [];
  for (let i = 0; i < count; i++) {
    const type = Math.random() > 0.5 ? 'row' : 'col';
    const idx = Math.floor(Math.random() * 4);
    const dir = Math.random() > 0.5 ? 1 : -1;
    moves.push({ type, idx, dir });
  }
  return moves;
}

async function uploadPuzzles() {
  const grids = JSON.parse(fs.readFileSync("./scripts/data/grids.json", "utf-8"));
  const startDate = new Date();
  const countToUpload = Math.min(grids.length, 30);
  
  for (let i = 0; i < countToUpload; i++) {
    const puzzleDate = new Date(startDate);
    puzzleDate.setDate(startDate.getDate() + i);
    const dateStr = puzzleDate.toISOString().split('T')[0];
    const solutionRows = grids[i]; // Store as array of strings
    
    const moveCount = 2;
    const scrambleMoves = generateScrambleMoves(moveCount);
    
    console.log(`Uploading puzzle for ${dateStr} (${moveCount} moves)...`);
    
    await setDoc(doc(db, "puzzles", dateStr), {
      solution: solutionRows, // ["WORD", "WORD", ...]
      scrambleMoves: scrambleMoves,
      publishDate: Timestamp.fromDate(puzzleDate)
    });
  }
  
  console.log("Upload complete!");
  process.exit(0);
}

uploadPuzzles().catch(console.error);
