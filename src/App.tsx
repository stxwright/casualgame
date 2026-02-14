import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trophy, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Grid } from './types';

export default function App() {
  const [grid, setGrid] = useState<Grid>([[' ',' ',' ',' '],[' ',' ',' ',' '],[' ',' ',' ',' '],[' ',' ',' ',' ']]);
  const [initialGrid, setInitialGrid] = useState<Grid | null>(null);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [levelId, setLevelId] = useState<string | number>(0);
  const [movesRemaining, setMovesRemaining] = useState(2);
  const [totalMoves, setTotalMoves] = useState(2);
  const [isSolved, setIsSolved] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [lastMoveType, setLastMoveType] = useState<'row' | 'col' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const startNewGame = useCallback(async () => {
    setIsLoading(true);
    let puzzleData: any = null;
    const today = new Date().toISOString().slice(0, 10);
    
    try {
      const snap = await getDoc(doc(db, 'puzzles', today));
      if (snap.exists()) {
        puzzleData = snap.data();
      } else {
        console.warn("No puzzle found for today:", today);
      }
    } catch (e) {
      console.error("Error fetching daily puzzle:", e);
    }

    if (puzzleData) {
      const finalSolution: Grid = puzzleData.solution.map((row: string) => row.split(''));
      const finalScrambleMoves: {type: 'row' | 'col', idx: number, dir: number}[] = puzzleData.scrambleMoves;
      setLevelId(today);

      // Apply scramble moves to the solution to create the starting grid
      let scrambledGrid = finalSolution.map(r => [...r]);
      finalScrambleMoves.forEach((move: {type: 'row' | 'col', idx: number, dir: number}) => {
        if (move.type === 'row') {
          scrambledGrid[move.idx] = shiftArray(scrambledGrid[move.idx], move.dir);
        } else {
          scrambledGrid = shiftColumn(scrambledGrid, move.idx, move.dir);
        }
      });

      setSolution(finalSolution);
      setGrid(scrambledGrid);
      setInitialGrid(scrambledGrid.map(r => [...r]));
      setMovesRemaining(finalScrambleMoves.length);
      setTotalMoves(finalScrambleMoves.length);
      setIsSolved(false);
      setShowModal(false);
      setShowFailureModal(false);
      setLastMoveType(null);
    } else {
      setGrid(Array(4).fill(null).map(() => Array(4).fill(' ')));
      setSolution(null);
      setMovesRemaining(0);
      setTotalMoves(0);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => { startNewGame(); }, [startNewGame]);

  const shiftArray = (arr: string[], dir: number) => {
    const newArr = [...arr];
    if (dir === 1) newArr.unshift(newArr.pop()!);
    else newArr.push(newArr.shift()!);
    return newArr;
  };

  const shiftColumn = (currentGrid: Grid, colIdx: number, dir: number) => {
    const newGrid = currentGrid.map(row => [...row]);
    const col = newGrid.map(row => row[colIdx]);
    const shiftedCol = shiftArray(col, dir);
    for (let i = 0; i < 4; i++) newGrid[i][colIdx] = shiftedCol[i];
    return newGrid;
  };

  const handleMove = (type: 'row' | 'col', idx: number, dir: number) => {
    if (isSolved || movesRemaining <= 0 || lastMoveType === type) return;
    const newGrid = type === 'row' 
      ? (() => { const g = [...grid.map(r => [...r])]; g[idx] = shiftArray(g[idx], dir); return g; })()
      : shiftColumn(grid, idx, dir);
    setGrid(newGrid);
    
    const newMovesRemaining = movesRemaining - 1;
    setMovesRemaining(newMovesRemaining);
    setLastMoveType(type);

    const won = JSON.stringify(newGrid) === JSON.stringify(solution);
    
    if (won) {
      setIsSolved(true);
      setTimeout(() => setShowModal(true), 2500);
    } else if (newMovesRemaining === 0) {
      setShowFailureModal(true);
    }
  };

  const resetLevel = () => {
    if (initialGrid) {
      setGrid(initialGrid.map(r => [...r]));
      setMovesRemaining(totalMoves);
      setIsSolved(false);
      setShowModal(false);
      setShowFailureModal(false);
      setLastMoveType(null);
    }
  };

  const shareResult = () => {
    const text = `WordWrap #${levelId} (${totalMoves - movesRemaining}/${totalMoves})\n\n🟩🟩🟩🟩\n🟩🟩🟩🟩\n🟩🟩🟩🟩\n🟩🟩🟩🟩`;
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const ICON_SIZE = 'calc(var(--s) * 0.45)';
  const canShowModal = (isSolved && showModal) || (!isSolved && showFailureModal);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-900 p-4 font-sans select-none overflow-hidden">
      
      <header 
        className="mb-[calc(var(--s)*0.4)] text-center"
        style={{ width: 'calc(var(--s)*4 + var(--gap)*3 + var(--board-padding)*2)' }}
      >
        <h1 style={{ fontSize: 'calc(var(--s)*0.8)' }} className="font-black tracking-tight text-blue-500 leading-none">WORDWRAP</h1>
        <p style={{ fontSize: 'calc(var(--s)*0.25)' }} className="text-slate-400 font-medium italic opacity-80 mt-1">4 words across, 4 words down</p>
      </header>

      <div 
        className="relative bg-slate-700 rounded-[calc(var(--s)*0.4)] border border-slate-600 shadow-2xl"
        style={{ 
          padding: 'var(--board-padding)',
          width: 'calc(var(--s)*4 + var(--gap)*3 + var(--board-padding)*2)',
          height: 'calc(var(--s)*4 + var(--gap)*3 + var(--board-padding)*2)'
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center rounded-[calc(var(--s)*0.4)] bg-slate-900/50 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          </div>
        )}
        {/* SHIFTERS: TOP */}
        <div className="absolute top-0 left-[var(--board-padding)] right-[var(--board-padding)] h-0">
          <div className="grid grid-cols-4 gap-[var(--gap)]">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex justify-center">
                <button onClick={() => handleMove('col', i, -1)} disabled={lastMoveType==='col' || movesRemaining===0 || isSolved}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginTop: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-500 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronUp size={ICON_SIZE} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SHIFTERS: LEFT */}
        <div className="absolute left-0 top-[var(--board-padding)] bottom-[var(--board-padding)] w-0">
          <div className="grid grid-rows-4 gap-[var(--gap)] h-full">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex items-center">
                <button onClick={() => handleMove('row', i, -1)} disabled={lastMoveType==='row' || movesRemaining===0 || isSolved}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginLeft: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-500 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronLeft size={ICON_SIZE} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* TILES GRID */}
        <div className="grid grid-cols-4 grid-rows-4 gap-[var(--gap)] w-full h-full">
          {grid.map((row, r) => row.map((char, c) => (
            <div key={`${r}-${c}`}
              style={{ width: 'var(--s)', height: 'var(--s)', fontSize: 'calc(var(--s) * 0.7)', animationDelay: isSolved ? `${(r*4+c)*100}ms` : '0ms' }}
              className={`flex items-center justify-center font-bold rounded-[calc(var(--s)*0.15)]
                ${isSolved ? 'bg-green-600 text-white animate-tile-win' : 'bg-slate-600 text-white shadow-[inset_0_calc(var(--s)*-0.08)_0_rgba(0,0,0,0.3)]'}`}
            >
              <span style={{ transform: isSolved ? 'none' : 'translateY(-4%)' }}>
                {char}
              </span>
            </div>
          )))}
        </div>

        {/* SHIFTERS: RIGHT */}
        <div className="absolute right-0 top-[var(--board-padding)] bottom-[var(--board-padding)] w-0">
          <div className="grid grid-rows-4 gap-[var(--gap)] h-full">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex items-center">
                <button onClick={() => handleMove('row', i, 1)} disabled={lastMoveType==='row' || movesRemaining===0 || isSolved}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginLeft: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-500 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronRight size={ICON_SIZE} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SHIFTERS: BOTTOM */}
        <div className="absolute bottom-0 left-[var(--board-padding)] right-[var(--board-padding)] h-0">
          <div className="grid grid-cols-4 gap-[var(--gap)]">
            {[0,1,2,3].map(i => (
              <div key={i} className="flex justify-center">
                <button onClick={() => handleMove('col', i, 1)} disabled={lastMoveType==='col' || movesRemaining===0 || isSolved}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginTop: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-500 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronDown size={ICON_SIZE} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* WIN/LOSE MODAL */}
        {canShowModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[calc(var(--s)*0.4)] bg-slate-900/95 backdrop-blur-sm animate-in fade-in zoom-in duration-300">
            {isSolved && <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"><X size={32}/></button>}
            <div className="text-center p-8">
              {isSolved ? (
                <>
                  <Trophy className="mx-auto mb-4 text-green-500 animate-bounce" size={64} />
                  <h2 className="text-4xl font-black mb-6 text-white">SOLVED!</h2>
                  <button onClick={shareResult} className="w-full rounded-xl bg-blue-600 py-4 text-xl font-bold hover:bg-blue-500 shadow-xl text-white">SHARE RESULT</button>
                </>
              ) : (
                <>
                  <h2 className="text-4xl font-black text-red-500 mb-6 uppercase leading-tight">OUT OF MOVES</h2>
                  <button onClick={resetLevel} className="w-full rounded-xl bg-slate-100 py-4 text-xl font-bold text-slate-900 hover:bg-white shadow-xl">RETRY</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-[calc(var(--s)*0.4)] text-center min-h-[calc(var(--s)*0.8)]">
        {isSolved ? (
          <button 
            onClick={() => setShowModal(true)} 
            style={{ 
              fontSize: 'calc(var(--s)*0.5)', 
              visibility: showModal ? 'hidden' : 'visible' 
            }} 
            className="font-black text-cyan-400 underline decoration-4 underline-offset-8"
          >
            SEE RESULTS
          </button>
        ) : (
          <div style={{ fontSize: 'calc(var(--s)*0.4)' }} className={`font-bold tracking-tight ${movesRemaining === 1 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
            Moves Left: <span className="text-cyan-400">{movesRemaining}</span>
          </div>
        )}
        <div style={{ fontSize: 'calc(var(--s)*0.25)' }} className="mt-2 font-mono text-slate-400 opacity-90">#{levelId}</div>
      </footer>

    </div>
  );
}