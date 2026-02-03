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
  const [moves, setMoves] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const startNewGame = useCallback(() => {
    const randomGrid = gridsData[Math.floor(Math.random() * gridsData.length)];
    const newGrid = randomGrid.map(row => row.split(''));
    
    // Perform random shuffles
    let shuffledGrid = [...newGrid.map(r => [...r])];
    for (let i = 0; i < 5; i++) {
      const isRow = Math.random() > 0.5;
      const idx = Math.floor(Math.random() * 4);
      const dir = Math.random() > 0.5 ? 1 : -1;
      if (isRow) {
        shuffledGrid[idx] = shiftArray(shuffledGrid[idx], dir);
      } else {
        shuffledGrid = shiftColumn(shuffledGrid, idx, dir);
      }
    }

    setGrid(shuffledGrid);
    setMoves(0);
    setIsSolved(false);
    setHistory([]);
  }, []);

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
    if (isSolved) return;
    const newGrid = [...grid.map(r => [...r])];
    newGrid[rowIdx] = shiftArray(newGrid[rowIdx], dir);
    setGrid(newGrid);
    setMoves(m => m + 1);
    if (checkWin(newGrid)) setIsSolved(true);
  };

  const handleShiftCol = (colIdx: number, dir: number) => {
    if (isSolved) return;
    const newGrid = shiftColumn(grid, colIdx, dir);
    setGrid(newGrid);
    setMoves(m => m + 1);
    if (checkWin(newGrid)) setIsSolved(true);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">
            WORDWRAP
          </h1>
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
                    ${isSolved ? 'bg-green-500 scale-105' : 'bg-slate-700 shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)]'}
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

        <div className="flex items-center justify-between px-4">
          <div className="text-xl font-bold text-slate-300">
            MOVES: <span className="text-cyan-400">{moves}</span>
          </div>
          <button 
            onClick={startNewGame}
            className="flex items-center gap-2 px-6 py-3 bg-slate-800 border border-slate-700 rounded-2xl hover:bg-slate-700 transition-colors font-bold text-slate-300"
          >
            <RefreshCw size={20} />
            NEW GAME
          </button>
        </div>

        {isSolved && (
          <div className="animate-bounce flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-3xl font-black text-green-400">
              <Trophy size={40} />
              SOLVED!
            </div>
            <p className="text-slate-400">Brilliant work on the train today.</p>
          </div>
        )}
      </div>
    </div>
  );
}
