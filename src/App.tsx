import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RefreshCw, Trophy } from 'lucide-react';
import gridsData from './data/grids.json';
import wordsData from './data/words.json';
import { Grid } from './types';

const VALID_WORDS = new Set(wordsData);

export default function App() {
  const [grid, setGrid] = useState<Grid>([
    [' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' '],
    [' ', ' ', ' ', ' '],
  ]);
  const [initialGrid, setInitialGrid] = useState<Grid | null>(null);
  const [levelId, setLevelId] = useState(0);
  const [shuffleCount] = useState(2); // Reduced from 3 to 2
  const [movesRemaining, setMovesRemaining] = useState(0);
  const [isSolved, setIsSolved] = useState(false);

  const startNewGame = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * gridsData.length);
    const randomGrid = gridsData[randomIndex];
    const newGrid = randomGrid.map(row => row.split(''));
    
    // Perform alternating shuffles
    let shuffledGrid = [...newGrid.map(r => [...r])];
    // Randomly decide whether to start with a row or a column
    const startWithRow = Math.random() > 0.5;
    
    for (let i = 0; i < shuffleCount; i++) {
      // Alternate: if i is even, use starting type; if odd, use the other
      const isRow = (i % 2 === 0) ? startWithRow : !startWithRow;
      const idx = Math.floor(Math.random() * 4);
      const dir = Math.random() > 0.5 ? 1 : -1;
      
      if (isRow) {
        shuffledGrid[idx] = shiftArray(shuffledGrid[idx], dir);
      } else {
        shuffledGrid = shiftColumn(shuffledGrid, idx, dir);
      }
    }

    setGrid(shuffledGrid);
    setInitialGrid(shuffledGrid.map(r => [...r]));
    setLevelId(randomIndex + 1);
    setMovesRemaining(shuffleCount); 
    setIsSolved(false);
  }, [shuffleCount]);

  const resetLevel = () => {
    if (initialGrid) {
      setGrid(initialGrid.map(r => [...r]));
      setMovesRemaining(shuffleCount);
      setIsSolved(false);
    }
  };

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const shiftArray = (arr: string[], dir: number) => {
    const newArr = [...arr];
    if (dir === 1) {
      const last = newArr.pop()!;
      newArr.unshift(last);
    } else {
      const first = newArr.shift()!;
      newArr.push(first);
    }
    return newArr;
  };

  const shiftColumn = (currentGrid: Grid, colIdx: number, dir: number) => {
    const newGrid = currentGrid.map(row => [...row]);
    const col = newGrid.map(row => row[colIdx]);
    const shiftedCol = shiftArray(col, dir);
    for (let i = 0; i < 4; i++) {
      newGrid[i][colIdx] = shiftedCol[i];
    }
    return newGrid;
  };

  const checkWin = (currentGrid: Grid) => {
    // Check rows
    for (const row of currentGrid) {
      if (!VALID_WORDS.has(row.join(''))) return false;
    }
    // Check cols
    for (let c = 0; c < 4; c++) {
      const col = currentGrid.map(r => r[c]).join('');
      if (!VALID_WORDS.has(col)) return false;
    }
    return true;
  };

  const handleShiftRow = (rowIdx: number, dir: number) => {
    if (isSolved || movesRemaining <= 0) return;
    const newGrid = [...grid.map(r => [...r])];
    newGrid[rowIdx] = shiftArray(newGrid[rowIdx], dir);
    setGrid(newGrid);
    setMovesRemaining(m => m - 1);
    if (checkWin(newGrid)) setIsSolved(true);
  };

  const handleShiftCol = (colIdx: number, dir: number) => {
    if (isSolved || movesRemaining <= 0) return;
    const newGrid = shiftColumn(grid, colIdx, dir);
    setGrid(newGrid);
    setMovesRemaining(m => m - 1);
    if (checkWin(newGrid)) setIsSolved(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full space-y-8">
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">
              WORDWRAP
            </h1>
            <span className="bg-slate-800 text-cyan-400 px-3 py-1 rounded-lg text-xs font-mono mt-4">
              #{levelId}
            </span>
          </div>
          <p className="text-slate-400 font-medium">Shift rows and columns to find the words</p>
        </header>

        <div className="relative p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
          {/* Column Up buttons */}
          <div className="absolute top-0 left-8 right-8 flex justify-between px-2 -translate-y-1/2">
            {[0, 1, 2, 3].map(i => (
              <button 
                key={i} 
                onClick={() => handleShiftCol(i, -1)}
                className="p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-colors shadow-lg group"
              >
                <ChevronUp size={20} className="group-active:scale-125 transition-transform" />
              </button>
            ))}
          </div>

          {/* Row Left buttons */}
          <div className="absolute top-8 bottom-8 left-0 flex flex-col justify-between py-2 -translate-x-1/2">
            {[0, 1, 2, 3].map(i => (
              <button 
                key={i} 
                onClick={() => handleShiftRow(i, -1)}
                className="p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-colors shadow-lg group"
              >
                <ChevronLeft size={20} className="group-active:scale-125 transition-transform" />
              </button>
            ))}
          </div>

          {/* THE GRID */}
          <div className="grid grid-cols-4 gap-3">
            {grid.map((row, r) => 
              row.map((char, c) => (
                <div 
                  key={`${r}-${c}`}
                  className={`
                    aspect-square flex items-center justify-center text-3xl font-bold rounded-xl
                    transition-all duration-300 transform
                    ${isSolved ? 'bg-green-500 scale-105 rotate-3' : 'bg-slate-700 shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)]'}
                  `}
                >
                  {char}
                </div>
              ))
            )}
          </div>

          {/* Row Right buttons */}
          <div className="absolute top-8 bottom-8 right-0 flex flex-col justify-between py-2 translate-x-1/2">
            {[0, 1, 2, 3].map(i => (
              <button 
                key={i} 
                onClick={() => handleShiftRow(i, 1)}
                className="p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-colors shadow-lg group"
              >
                <ChevronRight size={20} className="group-active:scale-125 transition-transform" />
              </button>
            ))}
          </div>

          {/* Column Down buttons */}
          <div className="absolute bottom-0 left-8 right-8 flex justify-between px-2 translate-y-1/2">
            {[0, 1, 2, 3].map(i => (
              <button 
                key={i} 
                onClick={() => handleShiftCol(i, 1)}
                className="p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-colors shadow-lg group"
              >
                <ChevronDown size={20} className="group-active:scale-125 transition-transform" />
              </button>
            ))}
          </div>
        </div>

        {/* FIXED HEIGHT STATUS AREA */}
        <div className="h-44 flex items-center justify-center">
          {isSolved ? (
            <div className="text-center space-y-4 animate-in zoom-in duration-500">
              <div className="flex flex-col items-center gap-1">
                <Trophy size={48} className="text-green-400 animate-bounce" />
                <h2 className="text-3xl font-black text-white">SOLVED!</h2>
                <p className="text-slate-400">Brilliant work today.</p>
              </div>
              <button 
                onClick={startNewGame}
                className="px-12 py-3 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-black text-xl transition-all transform hover:scale-105 active:scale-95 shadow-xl"
              >
                NEXT LEVEL
              </button>
            </div>
          ) : movesRemaining === 0 ? (
            <div className="text-center space-y-4 animate-in zoom-in duration-300">
              <div className="space-y-1">
                <h2 className="text-3xl font-black text-red-400">OUT OF MOVES</h2>
                <p className="text-slate-400">So close! Try again?</p>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <button 
                  onClick={resetLevel}
                  className="px-12 py-3 bg-slate-100 text-slate-900 rounded-2xl font-black text-xl hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                >
                  TRY AGAIN
                </button>
                <button 
                  onClick={startNewGame}
                  className="text-slate-500 hover:text-slate-300 font-bold transition-colors text-sm"
                >
                  Skip this level
                </button>
              </div>
            </div>
          ) : (
            <div className="text-slate-600 font-mono text-sm tracking-widest uppercase">
              Keep going...
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-4">
          <div className={`text-xl font-bold ${movesRemaining <= 2 && !isSolved ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
            MOVES LEFT: <span className="text-cyan-400">{movesRemaining}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={resetLevel}
              className="flex items-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl hover:bg-slate-700 transition-colors font-bold text-slate-300"
              title="Reset current level"
            >
              <RefreshCw size={20} />
            </button>
            <button 
              onClick={startNewGame}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 rounded-2xl transition-colors font-bold text-white shadow-lg"
            >
              NEW GAME
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
