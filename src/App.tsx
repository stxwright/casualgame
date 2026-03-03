import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trophy, X, Share2, HelpCircle, History } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore/lite';
import { db } from './firebase';
import { Grid, Move, Attempt, Feedback, GameState, MoveType } from './types';

const LAUNCH_DATE = new Date('2026-02-14T00:00:00Z');

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname.replace(/\/$/, '') || '/');
  const [grid, setGrid] = useState<Grid>([[' ',' ',' ',' '],[' ',' ',' ',' '],[' ',' ',' ',' '],[' ',' ',' ',' ']]);
  const [initialGrid, setInitialGrid] = useState<Grid | null>(null);
  const [solution, setSolution] = useState<Grid | null>(null);
  const [levelId, setLevelId] = useState<string | number>(0);
  const [puzzleNumber, setPuzzleNumber] = useState<number>(0);
  const [movesRemaining, setMovesRemaining] = useState(2);
  const [isSolved, setIsSolved] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [lastMoveType, setLastMoveType] = useState<MoveType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [requiredMoves, setRequiredMoves] = useState<Move[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [currentAttemptMoves, setCurrentAttemptMoves] = useState<Move[]>([]);
  const [currentAttemptFeedback, setCurrentAttemptFeedback] = useState<Feedback[]>([]);
  const [showCopied, setShowCopied] = useState(false);

  const startNewGame = useCallback(async (targetDate?: string) => {
    setIsLoading(true);
    let puzzleData: any = null;
    
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));

    const searchParams = new URLSearchParams(window.location.search);
    const puzzleParam = searchParams.get('puzzle');
    const today = targetDate || puzzleParam || localDate.toISOString().slice(0, 10);
    
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
      
      const pNum = Math.floor((new Date(today + 'T00:00:00Z').getTime() - LAUNCH_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setPuzzleNumber(pNum);

      const solMoves: Move[] = finalScrambleMoves.map(m => ({
        type: m.type as 'row' | 'col',
        idx: m.idx,
        dir: -m.dir
      }));
      setRequiredMoves(solMoves);

      let scrambledGrid = finalSolution.map(r => [...r]);
      finalScrambleMoves.forEach((move: {type: 'row' | 'col', idx: number, dir: number}) => {
        if (move.type === 'row') {
          scrambledGrid[move.idx] = shiftArray(scrambledGrid[move.idx], move.dir);
        } else {
          scrambledGrid = shiftColumn(scrambledGrid, move.idx, move.dir);
        }
      });

      setSolution(finalSolution);
      setInitialGrid(scrambledGrid.map(r => [...r]));

      // 1. Try date-specific key
      const dateKey = `wordwrap_game_state_${today}`;
      let savedStateStr = localStorage.getItem(dateKey);

      // 2. Fallback to legacy key (migration)
      if (!savedStateStr) {
        const legacyStateStr = localStorage.getItem('wordwrap_game_state');
        if (legacyStateStr) {
          try {
            const legacyState: GameState = JSON.parse(legacyStateStr);
            if (legacyState.levelId === today) {
              savedStateStr = legacyStateStr;
              // Clean up legacy key
              localStorage.removeItem('wordwrap_game_state');
            }
          } catch (e) {
            console.error("Error parsing legacy state:", e);
          }
        }
      }

      let loaded = false;
      if (savedStateStr) {
        try {
          const savedState: GameState = JSON.parse(savedStateStr);
          setGrid(savedState.grid);
          setAttempts(savedState.attempts);
          setCurrentAttemptMoves(savedState.currentAttemptMoves);
          setCurrentAttemptFeedback(savedState.currentAttemptFeedback);
          setMovesRemaining(savedState.movesRemaining);
          setIsSolved(savedState.isSolved);
          setLastMoveType(savedState.lastMoveType);
          loaded = true;
          
          setShowModal(savedState.isSolved);
          setShowFailureModal(!savedState.isSolved && savedState.attempts.length >= 6);
        } catch (e) {
          console.error("Error parsing saved state:", e);
        }
      }

      if (!loaded) {
        setGrid(scrambledGrid);
        setMovesRemaining(2);
        setIsSolved(false);
        setLastMoveType(null);
        setAttempts([]);
        setCurrentAttemptMoves([]);
        setCurrentAttemptFeedback([]);
        setShowModal(false);
        setShowFailureModal(false);
      }

      setLevelId(today);
    } else {
      setGrid(Array(4).fill(null).map(() => Array(4).fill(' ')));
      setSolution(null);
      setMovesRemaining(0);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => { startNewGame(); }, [startNewGame]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname.replace(/\/$/, '') || '/');
      startNewGame();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [startNewGame]);

  const navigateToPuzzle = useCallback((date?: string) => {
    const url = new URL(window.location.origin);
    if (date) {
      url.searchParams.set('puzzle', date);
    }
    window.history.pushState({}, '', url.pathname + url.search);
    setCurrentPath('/');
    startNewGame(date);
    setShowArchiveModal(false);
  }, [startNewGame]);

  useEffect(() => {
    if (puzzleNumber > 0) {
      const dateLabel = levelId ? new Date(levelId + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
      document.title = `WordWrap #${puzzleNumber}${dateLabel ? ` (${dateLabel})` : ''} — Daily Word Grid Puzzle Game | casualga.me`;
    }
  }, [puzzleNumber, levelId]);

  useEffect(() => {
    if (levelId === 0 || isLoading) return;

    const state: GameState = {
      levelId: levelId as string,
      grid,
      attempts,
      currentAttemptMoves,
      currentAttemptFeedback,
      movesRemaining,
      isSolved,
      lastMoveType
    };

    localStorage.setItem(`wordwrap_game_state_${levelId}`, JSON.stringify(state));
  }, [levelId, grid, attempts, currentAttemptMoves, currentAttemptFeedback, movesRemaining, isSolved, lastMoveType, isLoading]);

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

  const evaluateMove = (move: Move): Feedback => {
    const isCorrect = requiredMoves.some(rm => 
      rm.type === move.type && rm.idx === move.idx && rm.dir === move.dir
    );
    if (isCorrect) return 'correct';
    
    const isPartial = requiredMoves.some(rm => 
      rm.type === move.type && rm.idx === move.idx && rm.dir !== move.dir
    );
    if (isPartial) return 'partial';
    
    return 'incorrect';
  };

  const handleMove = (type: MoveType, idx: number, dir: number) => {
    if (isSolved || attempts.length >= 6 || movesRemaining <= 0 || lastMoveType === type) return;
    
    const move: Move = { type, idx, dir };
    const newGrid = type === 'row' 
      ? (() => { const g = [...grid.map(r => [...r])]; g[idx] = shiftArray(g[idx], dir); return g; })()
      : shiftColumn(grid, idx, dir);
    
    setGrid(newGrid);
    setLastMoveType(type);
    
    const feedback = evaluateMove(move);
    const newAttemptMoves = [...currentAttemptMoves, move];
    const newAttemptFeedback = [...currentAttemptFeedback, feedback];
    
    setCurrentAttemptMoves(newAttemptMoves);
    setCurrentAttemptFeedback(newAttemptFeedback);

    const newMovesRemaining = movesRemaining - 1;
    setMovesRemaining(newMovesRemaining);

    const won = JSON.stringify(newGrid) === JSON.stringify(solution);
    
    if (won) {
      setIsSolved(true);
      setAttempts(prev => [...prev, { moves: newAttemptMoves, feedback: newAttemptFeedback }]);
      setTimeout(() => setShowModal(true), 2000);
    } else if (newMovesRemaining === 0) {
      const finishedAttempt = { moves: newAttemptMoves, feedback: newAttemptFeedback };
      
      if (attempts.length >= 5) {
        setAttempts(prev => [...prev, finishedAttempt]);
        if (solution) setGrid(solution);
        setTimeout(() => setShowFailureModal(true), 2000);
      } else {
        setTimeout(() => {
          if (initialGrid) {
            setGrid(initialGrid.map(r => [...r]));
            setMovesRemaining(2);
            setLastMoveType(null);
            setCurrentAttemptMoves([]);
            setCurrentAttemptFeedback([]);
            setAttempts(prev => [...prev, finishedAttempt]);
          }
        }, 1200);
      }
    }
  };

  const shareResult = () => {
    const feedbackToEmoji = (f: Feedback) => {
      if (f === 'correct') return '🟩';
      if (f === 'partial') return '🟨';
      return '🟥';
    };

    const attemptCount = attempts.length;
    let badge = '';
    if (isSolved) {
      if (attemptCount === 1) badge = ' ⚡';
      else if (attemptCount <= 3) badge = ' 🎯';
    } else {
      badge = ' 😅';
    }

    const header = `Wordwrap #${puzzleNumber}\n${isSolved ? `Solved in ${attemptCount} attempt${attemptCount > 1 ? 's' : ''}!${badge}` : `Better luck tomorrow${badge}`}`;
    
    const gridEmojis = attempts.map(a => 
      a.feedback.map(feedbackToEmoji).join('')
    ).join('\n');

    const shareText = `${header}\n\n${gridEmojis}`;

    if (navigator.share) {
      navigator.share({ text: shareText }).catch(() => {
        navigator.clipboard.writeText(shareText);
        showCopyFeedback();
      });
    } else {
      navigator.clipboard.writeText(shareText);
      showCopyFeedback();
    }
  };

  const showCopyFeedback = () => {
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const archivePuzzles = useMemo(() => {
    if (!showArchiveModal) return [];

    const puzzles = [];
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    const todayStr = localDate.toISOString().slice(0, 10);

    const start = new Date(LAUNCH_DATE);
    const end = new Date(todayStr + 'T00:00:00Z');

    let current = new Date(end);
    while (current >= start) {
      const dateStr = current.toISOString().slice(0, 10);
      const pNum = Math.floor((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      const savedStateStr = localStorage.getItem(`wordwrap_game_state_${dateStr}`);
      let isSolvedForDate = false;
      if (savedStateStr) {
        try {
          isSolvedForDate = JSON.parse(savedStateStr).isSolved;
        } catch (e) {}
      }

      puzzles.push({ date: dateStr, number: pNum, isSolved: isSolvedForDate });
      current.setDate(current.getDate() - 1);
    }
    return puzzles;
  }, [showArchiveModal, levelId, isSolved]);

  const ICON_SIZE = 'calc(var(--s) * 0.45)';
  const MODAL_ICON_SIZE = 'calc(var(--s) * 1.1)';
  const MODAL_TITLE_SIZE = 'calc(var(--s) * 0.7)';
  const MODAL_SUBTITLE_SIZE = 'calc(var(--s) * 0.3)';
  const MODAL_GRID_SIZE = 'calc(var(--s) * 0.5)';
  const canShowModal = (isSolved && showModal) || (!isSolved && showFailureModal);

  if (currentPath === '/archive') {
    return <ArchivePage launchDate={LAUNCH_DATE} onNavigate={navigateToPuzzle} />;
  }

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center bg-slate-900 p-4 select-none overflow-hidden">
      
      <header 
        className="mb-[calc(var(--s)*0.4)] text-center relative"
        style={{ width: 'calc(var(--s)*4 + var(--gap)*3 + var(--board-padding)*2)' }}
      >
        <h1 style={{ fontSize: 'calc(var(--s)*0.85)' }} className="font-black tracking-tight leading-none">
          <span className="text-white">Word</span>
          <span className="text-blue-400">Wrap</span>
        </h1>
        <p style={{ fontSize: 'calc(var(--s)*0.25)' }} className="text-slate-300 font-medium italic mt-1">4 words across, 4 words down</p>
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
                <button
                  onClick={() => handleMove('col', i, -1)}
                  disabled={lastMoveType==='col' || movesRemaining===0 || isSolved || attempts.length >= 6}
                  aria-label={`Shift column ${i + 1} up`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginTop: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronUp size={24} style={{ width: ICON_SIZE, height: ICON_SIZE }} />
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
                <button
                  onClick={() => handleMove('row', i, -1)}
                  disabled={lastMoveType==='row' || movesRemaining===0 || isSolved || attempts.length >= 6}
                  aria-label={`Shift row ${i + 1} left`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginLeft: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronLeft size={24} style={{ width: ICON_SIZE, height: ICON_SIZE }} />
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
                ${isSolved ? 'bg-green-700 text-white animate-tile-win' : 'bg-slate-600 text-white shadow-[inset_0_calc(var(--s)*-0.08)_0_rgba(0,0,0,0.3)]'}`}
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
                <button
                  onClick={() => handleMove('row', i, 1)}
                  disabled={lastMoveType==='row' || movesRemaining===0 || isSolved || attempts.length >= 6}
                  aria-label={`Shift row ${i + 1} right`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginLeft: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronRight size={24} style={{ width: ICON_SIZE, height: ICON_SIZE }} />
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
                <button
                  onClick={() => handleMove('col', i, 1)}
                  disabled={lastMoveType==='col' || movesRemaining===0 || isSolved || attempts.length >= 6}
                  aria-label={`Shift column ${i + 1} down`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginTop: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 hover:text-white disabled:opacity-10 transition-colors">
                  <ChevronDown size={24} style={{ width: ICON_SIZE, height: ICON_SIZE }} />
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>

      <footer className="mt-[calc(var(--s)*0.4)] text-center min-h-[calc(var(--s)*1.2)] flex flex-col items-center justify-start">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchiveModal(true)}
            className="flex items-center justify-center p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all shadow-inner hover:scale-105 active:scale-95"
            aria-label="Archive"
          >
            <History size={32} style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>

          {(isSolved || attempts.length >= 6) ? (
            <button
              onClick={() => isSolved ? setShowModal(true) : setShowFailureModal(true)}
              style={{ fontSize: 'calc(var(--s)*0.5)' }}
              className="font-black text-cyan-400 underline decoration-4 underline-offset-8"
            >
              SEE RESULTS
            </button>
          ) : (
            <div className="flex items-center gap-4 bg-slate-800/50 px-6 py-3 rounded-2xl border border-slate-700/50 shadow-inner">
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Attempt</span>
                <span className="text-2xl font-black text-white leading-none">
                  {Math.min(attempts.length + 1, 6)}<span className="text-slate-600 mx-1">/</span>6
                </span>
              </div>
              
              <div className="h-8 w-px bg-slate-700" />
              
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Moves</span>
                <div className="flex gap-1.5">
                  {[...Array(2)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-4 w-4 rounded-sm transition-all duration-300 ${
                        i < (2 - movesRemaining) 
                          ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]' 
                          : 'bg-slate-700'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center justify-center p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all shadow-inner hover:scale-105 active:scale-95"
            aria-label="How to play"
          >
            <HelpCircle size={32} style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
        </div>

        <div style={{ fontSize: 'calc(var(--s)*0.25)' }} className="mt-4 font-mono text-slate-400 font-bold tracking-widest uppercase">
          Puzzle #{puzzleNumber}
        </div>
      </footer>

      {/* MODALS */}

      {/* ARCHIVE MODAL */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <button onClick={() => setShowArchiveModal(false)} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-[110]">
            <X style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
          <div className="flex flex-col h-full w-full max-w-lg p-6" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <h2 style={{ fontSize: MODAL_TITLE_SIZE }} className="font-black mb-4 text-white uppercase text-center shrink-0 leading-tight">Archive</h2>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 pb-6">
              <button
                onClick={() => navigateToPuzzle()}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/30 transition-all text-blue-400 font-bold mb-4"
              >
                <span>Back to Today</span>
                <ChevronRight size={20} />
              </button>

              {archivePuzzles.map((p) => (
                <PuzzleEntry
                  key={p.date}
                  p={p}
                  isCurrent={levelId === p.date}
                  onClick={() => navigateToPuzzle(p.date)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HOW TO PLAY MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <button onClick={() => setShowHelpModal(false)} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-[110]">
            <X style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
          <div className="text-center p-6 w-full max-w-lg overflow-y-auto max-h-full custom-scrollbar" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <h2 style={{ fontSize: MODAL_TITLE_SIZE }} className="font-black mb-4 text-white uppercase leading-tight">How to Play</h2>

            <div className="text-left space-y-4 text-slate-300 text-sm pb-4">
              <p>Shift rows and columns to arrange letters into <span className="text-white font-bold">4 words across</span> and <span className="text-white font-bold">4 words down</span>.</p>

              <div>
                <h3 className="text-blue-400 font-bold uppercase text-xs mb-1">Controls</h3>
                <p>Use the arrows around the grid to shift a row or column by one space. You cannot shift the same type (row or column) twice in a row.</p>
              </div>

              <div>
                <h3 className="text-blue-400 font-bold uppercase text-xs mb-1">Attempts</h3>
                <p>Each attempt consists of <span className="text-white font-bold">2 moves</span>. You have <span className="text-white font-bold">6 attempts</span> total. If the puzzle isn't solved after 2 moves, the grid resets for your next attempt.</p>
              </div>

              <div>
                <h3 className="text-blue-400 font-bold uppercase text-xs mb-1">Feedback</h3>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-green-500 shrink-0" />
                    <span><span className="text-green-500 font-bold">Correct:</span> This move is part of the solution.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-yellow-500 shrink-0" />
                    <span><span className="text-yellow-500 font-bold">Partial:</span> Right row/column, wrong direction.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-red-500 shrink-0" />
                    <span><span className="text-red-500 font-bold">Incorrect:</span> This row/column does not need shifting.</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="mt-8 w-full rounded-xl bg-blue-600 py-3 text-lg font-bold hover:bg-blue-500 shadow-xl text-white transition-all active:scale-95"
            >
              GOT IT!
            </button>
          </div>
        </div>
      )}

      {/* WIN/LOSE MODAL */}
      {canShowModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <button onClick={() => { setShowModal(false); setShowFailureModal(false); }} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-[110]">
            <X style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
          <div className="text-center p-8 w-full max-w-lg overflow-y-auto max-h-full custom-scrollbar" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <div className="flex flex-col items-center">
              {isSolved ? (
                <Trophy className="mb-4 text-green-500 animate-bounce" style={{ width: MODAL_ICON_SIZE, height: MODAL_ICON_SIZE }} />
              ) : (
                <div className="mb-4 text-red-500 flex items-center justify-center" style={{ width: MODAL_ICON_SIZE, height: MODAL_ICON_SIZE }}>
                  <X style={{ width: '100%', height: '100%' }} strokeWidth={3} />
                </div>
              )}
              
              <h2 style={{ fontSize: MODAL_TITLE_SIZE }} className="font-black mb-2 text-white uppercase leading-tight">
                {isSolved ? 'SOLVED!' : 'GAME OVER'}
              </h2>
              
              <p style={{ fontSize: MODAL_SUBTITLE_SIZE }} className="text-slate-400 mb-6 font-bold">
                {isSolved 
                  ? `In ${attempts.length} ${attempts.length === 1 ? 'attempt' : 'attempts'}`
                  : 'All attempts used'}
              </p>
              
              <div className="flex flex-col gap-1 mb-8 items-center">
                {attempts.map((a, i) => (
                  <div key={i} className="flex gap-1">
                    {a.feedback.map((f, j) => (
                      <div key={j} className={`rounded-sm ${f === 'correct' ? 'bg-green-500' : f === 'partial' ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: MODAL_GRID_SIZE, height: MODAL_GRID_SIZE }} />
                    ))}
                  </div>
                ))}
              </div>

              <button 
                onClick={shareResult} 
                style={{ padding: 'calc(var(--s) * 0.3) 0', fontSize: 'calc(var(--s) * 0.4)' }}
                className={`flex items-center justify-center gap-2 w-full rounded-xl font-bold shadow-xl text-white transition-all active:scale-95 ${
                  isSolved ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <Share2 size={24} style={{ width: 'calc(var(--s) * 0.4)', height: 'calc(var(--s) * 0.4)' }} />
                {showCopied ? 'COPIED!' : 'SHARE RESULT'}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
function PuzzleEntry({ p, isCurrent, onClick, isLink }: { p: any, isCurrent?: boolean, onClick?: () => void, isLink?: boolean }) {
  const content = (
    <>
      <div className="flex flex-col items-start text-left">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Puzzle #{p.number}</span>
        <span className="text-white font-bold">{new Date(p.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
      </div>
      <div className="flex items-center gap-3">
        {p.isSolved && (
          <div className="bg-green-500/20 p-1.5 rounded-full">
            <Trophy size={16} className="text-green-500" />
          </div>
        )}
        <ChevronRight size={20} className="text-slate-600 group-hover:text-blue-400 transition-colors" />
      </div>
    </>
  );

  const className = `w-full flex items-center justify-between p-4 rounded-xl border transition-all group
    ${isCurrent
      ? 'bg-slate-700 border-blue-500'
      : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`;

  if (isLink) {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (
      <a
        href={p.date === todayStr ? '/' : `/?puzzle=${p.date}`}
        className={className}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function ArchivePage({ launchDate, onNavigate }: { launchDate: Date, onNavigate: (date?: string) => void }) {
  const puzzles = useMemo(() => {
    const list = [];
    const today = new Date();
    let cursor = new Date(launchDate);
    while (cursor <= today) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const number = Math.floor((new Date(dateStr + 'T00:00:00Z').getTime() - launchDate.getTime()) / 86400000) + 1;
      const storageKey = `wordwrap_game_state_${dateStr}`;
      let isSolved = false;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) isSolved = JSON.parse(saved).isSolved === true;
      } catch {}
      list.push({ date: dateStr, number, isSolved });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return list.reverse();
  }, [launchDate]);

  useEffect(() => {
    document.title = 'Puzzle Archive — WordWrap | casualga.me';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute('content', 'Browse and play past WordWrap puzzles. Challenge yourself with previous daily word grid games from the archive.');
    }
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <main className="h-screen w-full bg-slate-900 text-slate-100 flex flex-col items-center p-6 overflow-y-auto custom-scrollbar font-sans">
      <div className="w-full max-w-lg">
        <header className="mb-12 text-center">
          <h1 style={{ fontSize: 'calc(var(--s) * 0.85)' }} className="font-black tracking-tight leading-none mb-6">
            <span className="text-white">Word</span>
            <span className="text-blue-400">Wrap</span>
          </h1>
          <h2 style={{ fontSize: 'calc(var(--s) * 0.7)' }} className="font-black mb-4 text-white uppercase text-center shrink-0 leading-tight">Archive</h2>
          <a
            href="/"
            className="text-blue-400 hover:text-blue-300 font-bold transition-colors inline-flex items-center gap-2 mt-4"
            onClick={(e) => { e.preventDefault(); onNavigate(); }}
          >
            <ChevronLeft size={20} />
            Back to Today's Puzzle
          </a>
        </header>

        <div className="grid gap-2">
          {puzzles.map((p) => (
            <PuzzleEntry
              key={p.date}
              p={p}
              isLink
              onClick={() => onNavigate(p.date)}
            />
          ))}
        </div>

        <footer className="mt-16 text-center text-slate-500 text-sm pb-12 uppercase tracking-widest font-bold">
          &copy; {new Date().getFullYear()} casualga.me
        </footer>
      </div>
    </main>
  );
}
