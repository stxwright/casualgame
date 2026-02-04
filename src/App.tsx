import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, RefreshCw, Trophy, X } from 'lucide-react';
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
  const [shuffleCount] = useState(2);
  const [movesRemaining, setMovesRemaining] = useState(2); // Start at shuffleCount to avoid flash
  const [isSolved, setIsSolved] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastMoveType, setLastMoveType] = useState<'row' | 'col' | null>(null);

  const startNewGame = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * gridsData.length);
    const randomGrid = gridsData[randomIndex];
    const newGrid = randomGrid.map(row => row.split(''));
    
    let shuffledGrid = [...newGrid.map(r => [...r])];
    const startWithRow = Math.random() > 0.5;
    
    for (let i = 0; i < shuffleCount; i++) {
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
    setShowModal(false);
    setLastMoveType(null);
  }, [shuffleCount]);

  const resetLevel = () => {
    if (initialGrid) {
      setGrid(initialGrid.map(r => [...r]));
      setMovesRemaining(shuffleCount);
      setIsSolved(false);
      setShowModal(false);
      setLastMoveType(null);
    }
  };

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  const shareResult = () => {
    const text = `WordWrap #${levelId}\nSolved in ${shuffleCount - movesRemaining}/${shuffleCount} moves\n\n🟩🟩🟩🟩\n🟩🟩🟩🟩\n🟩🟩🟩🟩\n🟩🟩🟩🟩`;
    navigator.clipboard.writeText(text);
    alert('Result copied to clipboard!');
  };

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
    for (const row of currentGrid) {
      if (!VALID_WORDS.has(row.join(''))) return false;
    }
    for (let c = 0; c < 4; c++) {
      const col = currentGrid.map(r => r[c]).join('');
      if (!VALID_WORDS.has(col)) return false;
    }
    return true;
  };

  const handleShiftRow = (rowIdx: number, dir: number) => {
    if (isSolved || movesRemaining <= 0 || lastMoveType === 'row') return;
    const newGrid = [...grid.map(r => [...r])];
    newGrid[rowIdx] = shiftArray(newGrid[rowIdx], dir);
    setGrid(newGrid);
    const newMoves = movesRemaining - 1;
    setMovesRemaining(newMoves);
    setLastMoveType('row');
    if (checkWin(newGrid)) {
      setIsSolved(true);
      setTimeout(() => setShowModal(true), 2500); // 2.5 second delay
    }
  };

  const handleShiftCol = (colIdx: number, dir: number) => {
    if (isSolved || movesRemaining <= 0 || lastMoveType === 'col') return;
    const newGrid = shiftColumn(grid, colIdx, dir);
    setGrid(newGrid);
    const newMoves = movesRemaining - 1;
    setMovesRemaining(newMoves);
    setLastMoveType('col');
    if (checkWin(newGrid)) {
      setIsSolved(true);
      setTimeout(() => setShowModal(true), 2500); // 2.5 second delay
    }
  };

  // Only show modal if level is actually initialized to avoid start-up flash
  const canShowModal = initialGrid !== null && ((isSolved && showModal) || (!isSolved && movesRemaining === 0));

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full space-y-4">
        <header className="text-center space-y-2 mb-4">
          <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-blue-600">
            WORDWRAP
          </h1>
          <p className="text-slate-400 font-medium italic">Unscramble the 4x4 square: 4 words across, 4 words down.</p>
        </header>

        <div className="relative p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700">
          {/* Column Up buttons */}
          <div className="absolute top-0 left-8 right-8 flex justify-between px-2 -translate-y-1/2">
            {[0, 1, 2, 3].map(i => (
              <button 
                key={i} 
                onClick={() => handleShiftCol(i, -1)}
                disabled={lastMoveType === 'col' || movesRemaining === 0 || isSolved}
                className={`p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-all shadow-lg group ${(lastMoveType === 'col' || movesRemaining === 0 || isSolved) ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
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
                disabled={lastMoveType === 'row' || movesRemaining === 0 || isSolved}
                className={`p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-all shadow-lg group ${(lastMoveType === 'row' || movesRemaining === 0 || isSolved) ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
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
                  style={{ animationDelay: isSolved ? `${(r * 4 + c) * 100}ms` : '0ms' }}
                  className={`
                    aspect-square flex items-center justify-center text-3xl font-bold rounded-xl
                    transition-all duration-300 transform
                    ${isSolved 
                      ? 'animate-tile-win text-white shadow-xl shadow-green-500/20' 
                      : 'bg-slate-700 text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.3)]'}
                  `}
                >
                  {char}
                </div>
              ))
            )}
          </div>

          {/* OVERLAY MODAL */}
          {canShowModal && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 bg-slate-900/95 rounded-3xl backdrop-blur-sm animate-in fade-in zoom-in duration-300">
              {isSolved && (
                <button 
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              )}
              
              <div className="text-center space-y-6">
                {isSolved ? (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <Trophy size={64} className="text-green-400 animate-bounce" />
                      <h2 className="text-4xl font-black text-white">SOLVED!</h2>
                      <p className="text-slate-300">Masterful work on the train today.</p>
                    </div>
                    <button 
                      onClick={shareResult}
                      className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xl transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                    >
                      SHARE RESULT
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <h2 className="text-4xl font-black text-red-400">OUT OF MOVES</h2>
                      <p className="text-slate-300">Don't give up now!</p>
                    </div>
                    <button 
                      onClick={resetLevel}
                      className="w-full py-4 bg-slate-100 text-slate-900 rounded-2xl font-black text-xl hover:bg-white transition-all transform hover:scale-105 active:scale-95 shadow-xl"
                    >
                      TRY AGAIN
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Row Right buttons */}
          <div className="absolute top-8 bottom-8 right-0 flex flex-col justify-between py-2 translate-x-1/2">
            {[0, 1, 2, 3].map(i => (
              <button 
                key={i} 
                onClick={() => handleShiftRow(i, 1)}
                disabled={lastMoveType === 'row' || movesRemaining === 0 || isSolved}
                className={`p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-all shadow-lg group ${(lastMoveType === 'row' || movesRemaining === 0 || isSolved) ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
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
                disabled={lastMoveType === 'col' || movesRemaining === 0 || isSolved}
                className={`p-2 bg-slate-700 rounded-full hover:bg-cyan-500 transition-all shadow-lg group ${(lastMoveType === 'col' || movesRemaining === 0 || isSolved) ? 'opacity-20 grayscale cursor-not-allowed' : ''}`}
              >
                <ChevronDown size={20} className="group-active:scale-125 transition-transform" />
              </button>
            ))}
          </div>
        </div>

        {/* STATUS AREA */}
        <div className="flex flex-col items-center justify-center pt-2 relative">
          <div className={`text-2xl font-bold tracking-tight ${movesRemaining === 1 && !isSolved ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
            Moves Left: <span className="text-cyan-400">{movesRemaining}</span>
          </div>

          <div className="absolute right-0 top-2">
            <span className="text-slate-500 text-sm font-mono tracking-tighter">
              #{levelId}
            </span>
          </div>
          
          <div className="h-12 flex items-center mt-2">
            {isSolved && !showModal && (
              <button 
                onClick={() => setShowModal(true)}
                className="text-cyan-400 hover:text-cyan-300 font-bold underline decoration-2 underline-offset-4 transition-all"
              >
                See Results
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
