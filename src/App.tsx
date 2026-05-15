import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Trophy, X, HelpCircle, History, RotateCcw, Frown } from 'lucide-react';
import { Grid, Move, Attempt, Feedback, GameState, MoveType } from './types';

// ---------------------------------------------------------------------------
// Game constants — change here and everything updates automatically
// ---------------------------------------------------------------------------
const GRID_SIZE = 4;
const MOVES_PER_ATTEMPT = 2;
const MAX_ATTEMPTS = 6;

// ---------------------------------------------------------------------------
// Puzzle data shape
// ---------------------------------------------------------------------------
interface ScrambleMove {
  type: 'row' | 'col';
  idx: number;
  dir: number;
}

interface PuzzleData {
  solution: string[];
  scrambleMoves: ScrambleMove[];
}

// ---------------------------------------------------------------------------
// UI size constants — fixed strings, no reason to live inside the component
// ---------------------------------------------------------------------------
const ICON_SIZE = 'calc(var(--s) * 0.45)';
const MODAL_ICON_SIZE = 'calc(var(--s) * 1.1)';
const MODAL_TITLE_SIZE = 'calc(var(--s) * 0.7)';
const MODAL_SUBTITLE_SIZE = 'calc(var(--s) * 0.3)';
const MODAL_GRID_SIZE = 'calc(var(--s) * 0.5)';

// ---------------------------------------------------------------------------
// Pure grid helpers — no component state, live outside to avoid recreation
// ---------------------------------------------------------------------------
function shiftArray(arr: string[], dir: number): string[] {
  const next = [...arr];
  if (dir === 1) next.unshift(next.pop()!);
  else next.push(next.shift()!);
  return next;
}

function shiftRow(grid: Grid, rowIdx: number, dir: number): Grid {
  const next = grid.map(r => [...r]);
  next[rowIdx] = shiftArray(next[rowIdx], dir);
  return next;
}

function shiftColumn(grid: Grid, colIdx: number, dir: number): Grid {
  const next = grid.map(r => [...r]);
  const col = next.map(r => r[colIdx]);
  const shifted = shiftArray(col, dir);
  for (let i = 0; i < GRID_SIZE; i++) next[i][colIdx] = shifted[i];
  return next;
}

function gridsEqual(a: Grid, b: Grid | null): boolean {
  if (!b) return false;
  return a.every((row, r) => row.every((cell, c) => cell === b[r][c]));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function App() {
  const [grid, setGrid] = useState<Grid>(
    Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(' '))
  );
  const [initialGrid, setInitialGrid]   = useState<Grid | null>(null);
  const [solution, setSolution]         = useState<Grid | null>(null);
  const [levelId, setLevelId]           = useState<number | null>(null);
  const [movesRemaining, setMovesRemaining] = useState(MOVES_PER_ATTEMPT);
  const [isSolved, setIsSolved]         = useState(false);
  const [showModal, setShowModal]       = useState(false);
  const [showHelpModal, setShowHelpModal]     = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showFailModal, setShowFailModal]     = useState(false);
  const [lastMoveType, setLastMoveType] = useState<MoveType | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  const [requiredMoves, setRequiredMoves]               = useState<Move[]>([]);
  const [attempts, setAttempts]                         = useState<Attempt[]>([]);
  const [currentAttemptMoves, setCurrentAttemptMoves]   = useState<Move[]>([]);
  const [currentAttemptFeedback, setCurrentAttemptFeedback] = useState<Feedback[]>([]);
  const [failedAttempts, setFailedAttempts]             = useState<Attempt[]>([]);

  // Puzzle list — drives the archive modal display
  const [allPuzzles, setAllPuzzles] = useState<PuzzleData[] | null>(null);

  // Stable cache ref so startNewGame doesn't need allPuzzles as a dep,
  // which would cause the init useEffect to re-run after the first fetch.
  const puzzlesCacheRef = useRef<PuzzleData[] | null>(null);

  // 1-based number for display; null guard prevents the "#0" flicker on load
  const puzzleNumber = levelId !== null ? levelId + 1 : null;

  // -------------------------------------------------------------------------
  // Game initialisation
  // -------------------------------------------------------------------------
  const startNewGame = useCallback(async (targetIdx?: number) => {
    setIsLoading(true);

    let puzzles = puzzlesCacheRef.current;
    if (!puzzles) {
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}puzzles.json`);
        puzzles = await resp.json() as PuzzleData[];
        puzzlesCacheRef.current = puzzles;
        setAllPuzzles(puzzles);
      } catch (e) {
        console.error('Error fetching puzzles:', e);
        setIsLoading(false);
        return;
      }
    }

    // Clamp to valid range so out-of-bounds URLs (e.g. /#/99999) redirect to
    // the nearest real puzzle rather than showing a blank board.
    const requestedIdx = targetIdx ?? 0;
    const idx = Math.max(0, Math.min(requestedIdx, puzzles.length - 1));

    if (idx !== requestedIdx) {
      window.history.replaceState({}, '', `#/${idx + 1}`);
    }

    const puzzleData = puzzles[idx];
    const finalSolution: Grid = puzzleData.solution.map(row => row.split(''));

    const solMoves: Move[] = puzzleData.scrambleMoves.map(m => ({
      type: m.type,
      idx: m.idx,
      dir: -m.dir,
    }));
    setRequiredMoves(solMoves);

    let scrambledGrid = finalSolution.map(r => [...r]);
    for (const move of puzzleData.scrambleMoves) {
      scrambledGrid = move.type === 'row'
        ? shiftRow(scrambledGrid, move.idx, move.dir)
        : shiftColumn(scrambledGrid, move.idx, move.dir);
    }

    setSolution(finalSolution);
    setInitialGrid(scrambledGrid.map(r => [...r]));

    const savedStateStr = localStorage.getItem(`wordwrap_game_state_${idx}`);
    let loaded = false;

    if (savedStateStr) {
      try {
        const savedState: GameState = JSON.parse(savedStateStr);

        // If previously failed (ran out of attempts without solving), treat as
        // a fresh start — don't restore a locked-out state. This also covers
        // the edge case where the player closed the tab mid-fail-modal.
        const wasFailed = !savedState.isSolved && savedState.attempts.length >= MAX_ATTEMPTS;

        if (!wasFailed) {
          setGrid(savedState.grid);
          setAttempts(savedState.attempts);
          setCurrentAttemptMoves(savedState.currentAttemptMoves);
          setCurrentAttemptFeedback(savedState.currentAttemptFeedback);
          setMovesRemaining(savedState.movesRemaining);
          setIsSolved(savedState.isSolved);
          setLastMoveType(savedState.lastMoveType);
          setShowModal(savedState.isSolved);
          loaded = true;
        }
      } catch (e) {
        console.error('Error parsing saved state:', e);
      }
    }

    if (!loaded) {
      setGrid(scrambledGrid);
      setMovesRemaining(MOVES_PER_ATTEMPT);
      setIsSolved(false);
      setLastMoveType(null);
      setAttempts([]);
      setCurrentAttemptMoves([]);
      setCurrentAttemptFeedback([]);
      setShowModal(false);
    }

    setLevelId(idx);
    setIsLoading(false);
  }, []); // stable — reads puzzles from ref, not state

  // -------------------------------------------------------------------------
  // Initial route parsing: #/1, #/2, #/42, etc.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const hash = window.location.hash.replace(/^#\//, '');
    const num = parseInt(hash, 10);
    startNewGame(!isNaN(num) && num > 0 ? num - 1 : 0);
  }, [startNewGame]);

  // -------------------------------------------------------------------------
  // Persist state to localStorage on every relevant change
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (levelId === null || isLoading) return;

    const state: GameState = {
      levelId,
      grid,
      attempts,
      currentAttemptMoves,
      currentAttemptFeedback,
      movesRemaining,
      isSolved,
      lastMoveType,
    };

    localStorage.setItem(`wordwrap_game_state_${levelId}`, JSON.stringify(state));
  }, [levelId, grid, attempts, currentAttemptMoves, currentAttemptFeedback, movesRemaining, isSolved, lastMoveType, isLoading]);

  // -------------------------------------------------------------------------
  // Move handling
  // -------------------------------------------------------------------------
  const evaluateMove = (move: Move): Feedback => {
    const sameAxis = requiredMoves.filter(rm => rm.type === move.type && rm.idx === move.idx);
    if (sameAxis.some(rm => rm.dir === move.dir)) return 'correct';
    if (sameAxis.length > 0) return 'partial';
    return 'incorrect';
  };

  // handleMove has many volatile deps so useCallback buys nothing here —
  // the JSX arrow wrappers recreate on every render regardless.
  const handleMove = (type: MoveType, idx: number, dir: number) => {
    if (isSolved || movesRemaining <= 0 || lastMoveType === type) return;

    const move: Move = { type, idx, dir };
    const newGrid = type === 'row'
      ? shiftRow(grid, idx, dir)
      : shiftColumn(grid, idx, dir);

    setGrid(newGrid);
    setLastMoveType(type);

    const feedback = evaluateMove(move);
    const newAttemptMoves    = [...currentAttemptMoves, move];
    const newAttemptFeedback = [...currentAttemptFeedback, feedback];

    setCurrentAttemptMoves(newAttemptMoves);
    setCurrentAttemptFeedback(newAttemptFeedback);

    const newMovesRemaining = movesRemaining - 1;
    setMovesRemaining(newMovesRemaining);

    if (gridsEqual(newGrid, solution)) {
      setIsSolved(true);
      setAttempts(prev => [...prev, { moves: newAttemptMoves, feedback: newAttemptFeedback }]);
      setTimeout(() => setShowModal(true), 2000);
    } else if (newMovesRemaining === 0) {
      const newAttempts = [...attempts, { moves: newAttemptMoves, feedback: newAttemptFeedback }];

      if (newAttempts.length >= MAX_ATTEMPTS) {
        // All attempts used — show the fail modal, then let the player decide.
        setAttempts(newAttempts);
        setTimeout(() => {
          setFailedAttempts(newAttempts);
          setShowFailModal(true);
        }, 1200);
      } else {
        setTimeout(() => {
          if (initialGrid) {
            setGrid(initialGrid.map(r => [...r]));
            setMovesRemaining(MOVES_PER_ATTEMPT);
            setLastMoveType(null);
            setCurrentAttemptMoves([]);
            setCurrentAttemptFeedback([]);
            setAttempts(newAttempts);
          }
        }, 1200);
      }
    }
  };

  const handleTryAgain = useCallback(() => {
    setShowFailModal(false);
    if (initialGrid) {
      setGrid(initialGrid.map(r => [...r]));
      setMovesRemaining(MOVES_PER_ATTEMPT);
      setLastMoveType(null);
      setAttempts([]);
      setCurrentAttemptMoves([]);
      setCurrentAttemptFeedback([]);
      setFailedAttempts([]);
    }
  }, [initialGrid]);

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------
  const navigateToPuzzle = useCallback((idx: number) => {
    window.history.pushState({}, '', `#/${idx + 1}`);
    startNewGame(idx);
  }, [startNewGame]);

  const hasNextPuzzle = allPuzzles !== null && levelId !== null && levelId < allPuzzles.length - 1;
  const hasPrevPuzzle = levelId !== null && levelId > 0;

  // -------------------------------------------------------------------------
  // Archive puzzle list
  // -------------------------------------------------------------------------
  const archivePuzzles = useMemo(() => {
    if (!showArchiveModal || !allPuzzles) return [];

    return allPuzzles.map((_, idx) => {
      const savedStateStr = localStorage.getItem(`wordwrap_game_state_${idx}`);
      let isSolvedForPuzzle    = false;
      let isAttemptedForPuzzle = false;

      if (savedStateStr) {
        try {
          const s = JSON.parse(savedStateStr);
          isSolvedForPuzzle    = s.isSolved;
          isAttemptedForPuzzle = !s.isSolved && (s.attempts.length > 0 || s.currentAttemptMoves.length > 0);
        } catch {
          // Corrupted localStorage entry — treat as untouched
        }
      }

      return { index: idx, number: idx + 1, isSolved: isSolvedForPuzzle, isAttempted: isAttemptedForPuzzle };
    });
  }, [showArchiveModal, levelId, isSolved, allPuzzles]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
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
        <p style={{ fontSize: 'calc(var(--s)*0.25)' }} className="text-slate-300 font-medium italic mt-1">
          4 words across, 4 words down
        </p>
      </header>

      {/* BOARD */}
      <div
        className="relative bg-slate-700 rounded-[calc(var(--s)*0.4)] border border-slate-600 shadow-2xl"
        style={{
          padding: 'var(--board-padding)',
          width:  'calc(var(--s)*4 + var(--gap)*3 + var(--board-padding)*2)',
          height: 'calc(var(--s)*4 + var(--gap)*3 + var(--board-padding)*2)',
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center rounded-[calc(var(--s)*0.4)] bg-slate-900/50 backdrop-blur-sm">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        )}

        {/* SHIFTERS: TOP */}
        <div className="absolute top-0 left-[var(--board-padding)] right-[var(--board-padding)] h-0">
          <div className="grid grid-cols-4 gap-[var(--gap)]">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex justify-center">
                <button
                  onClick={() => handleMove('col', i, -1)}
                  disabled={lastMoveType === 'col' || movesRemaining === 0 || isSolved}
                  aria-label={`Shift column ${i + 1} up`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginTop: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 disabled:opacity-10 transition-colors"
                >
                  <ChevronUp style={{ width: ICON_SIZE, height: ICON_SIZE }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SHIFTERS: LEFT */}
        <div className="absolute left-0 top-[var(--board-padding)] bottom-[var(--board-padding)] w-0">
          <div className="grid grid-rows-4 gap-[var(--gap)] h-full">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center">
                <button
                  onClick={() => handleMove('row', i, -1)}
                  disabled={lastMoveType === 'row' || movesRemaining === 0 || isSolved}
                  aria-label={`Shift row ${i + 1} left`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginLeft: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 disabled:opacity-10 transition-colors"
                >
                  <ChevronLeft style={{ width: ICON_SIZE, height: ICON_SIZE }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* TILES */}
        <div className="grid grid-cols-4 grid-rows-4 gap-[var(--gap)] w-full h-full">
          {grid.map((row, r) => row.map((char, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                width: 'var(--s)',
                height: 'var(--s)',
                fontSize: 'calc(var(--s) * 0.7)',
                animationDelay: isSolved ? `${(r * GRID_SIZE + c) * 100}ms` : '0ms',
              }}
              className={`flex items-center justify-center font-bold rounded-[calc(var(--s)*0.15)]
                ${isSolved
                  ? 'bg-green-700 text-white animate-tile-win'
                  : 'bg-slate-600 text-white shadow-[inset_0_calc(var(--s)*-0.08)_0_rgba(0,0,0,0.3)]'}`}
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
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex items-center">
                <button
                  onClick={() => handleMove('row', i, 1)}
                  disabled={lastMoveType === 'row' || movesRemaining === 0 || isSolved}
                  aria-label={`Shift row ${i + 1} right`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginLeft: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 disabled:opacity-10 transition-colors"
                >
                  <ChevronRight style={{ width: ICON_SIZE, height: ICON_SIZE }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SHIFTERS: BOTTOM */}
        <div className="absolute bottom-0 left-[var(--board-padding)] right-[var(--board-padding)] h-0">
          <div className="grid grid-cols-4 gap-[var(--gap)]">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="flex justify-center">
                <button
                  onClick={() => handleMove('col', i, 1)}
                  disabled={lastMoveType === 'col' || movesRemaining === 0 || isSolved}
                  aria-label={`Shift column ${i + 1} down`}
                  style={{ width: 'var(--btn-size)', height: 'var(--btn-size)', marginTop: 'calc(var(--btn-size) * -0.5)' }}
                  className="flex items-center justify-center rounded-full bg-slate-600 text-white shadow-xl hover:bg-blue-600 disabled:opacity-10 transition-colors"
                >
                  <ChevronDown style={{ width: ICON_SIZE, height: ICON_SIZE }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-[calc(var(--s)*0.4)] text-center min-h-[calc(var(--s)*1.2)] flex flex-col items-center justify-start">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowArchiveModal(true)}
            className="flex items-center justify-center p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white transition-all shadow-inner hover:scale-105 active:scale-95"
            aria-label="Browse puzzles"
          >
            <History style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>

          {isSolved ? (
            <button
              onClick={() => setShowModal(true)}
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
                  {Math.min(attempts.length + 1, MAX_ATTEMPTS)}
                  <span className="text-slate-600 mx-1">/</span>
                  {MAX_ATTEMPTS}
                </span>
              </div>

              <div className="h-8 w-px bg-slate-700" />

              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mb-1">Moves</span>
                <div className="flex gap-1.5">
                  {Array.from({ length: MOVES_PER_ATTEMPT }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-4 w-4 rounded-sm transition-all duration-300 ${
                        i < MOVES_PER_ATTEMPT - movesRemaining
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
            <HelpCircle style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
        </div>

        {/* Puzzle number + prev/next navigation */}
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={() => levelId !== null && navigateToPuzzle(levelId - 1)}
            disabled={!hasPrevPuzzle}
            aria-label="Previous puzzle"
            className="text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronLeft style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>

          <div style={{ fontSize: 'calc(var(--s)*0.25)' }} className="font-mono text-slate-400 font-bold tracking-widest uppercase">
            {puzzleNumber !== null ? `Puzzle #${puzzleNumber}` : ''}
          </div>

          <button
            onClick={() => levelId !== null && navigateToPuzzle(levelId + 1)}
            disabled={!hasNextPuzzle}
            aria-label="Next puzzle"
            className="text-slate-400 hover:text-white disabled:opacity-20 transition-colors"
          >
            <ChevronRight style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
        </div>
      </footer>

      {/* ------------------------------------------------------------------ */}
      {/* MODALS                                                               */}
      {/* ------------------------------------------------------------------ */}

      {/* BROWSE / ARCHIVE MODAL */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <button
            onClick={() => setShowArchiveModal(false)}
            aria-label="Close"
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-[110]"
          >
            <X style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
          <div className="flex flex-col h-full w-full max-w-lg p-6" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <h2 style={{ fontSize: MODAL_TITLE_SIZE }} className="font-black mb-4 text-white uppercase text-center shrink-0 leading-tight">
              Puzzles
            </h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 pb-6">
              {archivePuzzles.map(p => (
                <button
                  key={p.number}
                  onClick={() => { navigateToPuzzle(p.index); setShowArchiveModal(false); }}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all
                    ${levelId === p.index
                      ? 'bg-slate-700 border-blue-500'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Puzzle #{p.number}
                  </span>
                  {p.isSolved && (
                    <div className="bg-green-500/20 p-1.5 rounded-full">
                      <Trophy size={16} className="text-green-500" />
                    </div>
                  )}
                  {!p.isSolved && p.isAttempted && (
                    <div className="bg-slate-600/40 p-1.5 rounded-full">
                      <RotateCcw size={16} className="text-slate-400" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HOW TO PLAY MODAL */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <button
            onClick={() => setShowHelpModal(false)}
            aria-label="Close"
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-[110]"
          >
            <X style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
          <div className="text-center p-6 w-full max-w-lg overflow-y-auto max-h-full custom-scrollbar" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <h2 style={{ fontSize: MODAL_TITLE_SIZE }} className="font-black mb-4 text-white uppercase leading-tight">
              How to Play
            </h2>
            <div className="text-left space-y-4 text-slate-300 text-sm pb-4">
              <p>
                Shift rows and columns to arrange letters into{' '}
                <span className="text-white font-bold">4 words across</span> and{' '}
                <span className="text-white font-bold">4 words down</span>.
              </p>
              <div>
                <h3 className="text-blue-400 font-bold uppercase text-xs mb-1">Controls</h3>
                <p>Use the arrows around the grid to shift a row or column by one space. You cannot shift the same type (row or column) twice in a row.</p>
              </div>
              <div>
                <h3 className="text-blue-400 font-bold uppercase text-xs mb-1">Attempts</h3>
                <p>
                  Each attempt consists of{' '}
                  <span className="text-white font-bold">{MOVES_PER_ATTEMPT} moves</span>.
                  You have{' '}
                  <span className="text-white font-bold">{MAX_ATTEMPTS} attempts</span>{' '}
                  per round. If you use all {MAX_ATTEMPTS} without solving, the puzzle resets so you can try again.
                </p>
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

      {/* WIN MODAL */}
      {isSolved && showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <button
            onClick={() => setShowModal(false)}
            aria-label="Close"
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-[110]"
          >
            <X style={{ width: ICON_SIZE, height: ICON_SIZE }} />
          </button>
          <div className="text-center p-8 w-full max-w-lg overflow-y-auto max-h-full custom-scrollbar" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <div className="flex flex-col items-center">
              <Trophy className="mb-4 text-green-500 animate-bounce" style={{ width: MODAL_ICON_SIZE, height: MODAL_ICON_SIZE }} />
              <h2 style={{ fontSize: MODAL_TITLE_SIZE }} className="font-black mb-2 text-white uppercase leading-tight">
                SOLVED!
              </h2>
              <p style={{ fontSize: MODAL_SUBTITLE_SIZE }} className="text-slate-400 mb-6 font-bold">
                In {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
              </p>
              <div className="flex flex-col gap-1 mb-8 items-center">
                {attempts.map((a, i) => (
                  <div key={i} className="flex gap-1">
                    {a.feedback.map((f, j) => (
                      <div
                        key={j}
                        className={`rounded-sm ${f === 'correct' ? 'bg-green-500' : f === 'partial' ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: MODAL_GRID_SIZE, height: MODAL_GRID_SIZE }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {hasNextPuzzle ? (
                <button
                  onClick={() => { setShowModal(false); if (levelId !== null) navigateToPuzzle(levelId + 1); }}
                  style={{ padding: 'calc(var(--s) * 0.3) 0', fontSize: 'calc(var(--s) * 0.4)' }}
                  className="flex items-center justify-center gap-2 w-full rounded-xl font-bold shadow-xl text-white bg-blue-600 hover:bg-blue-500 transition-all active:scale-95"
                >
                  NEXT PUZZLE
                  <ChevronRight style={{ width: 'calc(var(--s) * 0.4)', height: 'calc(var(--s) * 0.4)' }} />
                </button>
              ) : (
                <div
                  style={{ padding: 'calc(var(--s) * 0.3) 0', fontSize: 'calc(var(--s) * 0.35)' }}
                  className="w-full rounded-xl font-bold text-slate-400 border border-slate-700 bg-slate-800/50 text-center"
                >
                  YOU'VE FINISHED ALL PUZZLES 🎉
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FAIL MODAL */}
      {showFailModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="text-center p-5 w-full max-w-lg" style={{ minWidth: 'min(90vw, calc(var(--s) * 5))' }}>
            <div className="flex flex-col items-center">
              <Frown className="mb-2 text-slate-400" style={{ width: 'calc(var(--s) * 0.7)', height: 'calc(var(--s) * 0.7)' }} />
              <h2 style={{ fontSize: 'calc(var(--s) * 0.55)' }} className="font-black mb-1 text-white uppercase leading-tight">
                NOT THIS TIME
              </h2>
              <p style={{ fontSize: MODAL_SUBTITLE_SIZE }} className="text-slate-400 mb-3 font-bold">
                You used all {MAX_ATTEMPTS} attempts
              </p>
              <div className="flex flex-col gap-1 mb-4 items-center">
                {failedAttempts.map((a, i) => (
                  <div key={i} className="flex gap-1">
                    {a.feedback.map((f, j) => (
                      <div
                        key={j}
                        className={`rounded-sm ${f === 'correct' ? 'bg-green-500' : f === 'partial' ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: 'calc(var(--s) * 0.32)', height: 'calc(var(--s) * 0.32)' }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <button
                onClick={handleTryAgain}
                style={{ padding: 'calc(var(--s) * 0.22) 0', fontSize: 'calc(var(--s) * 0.38)' }}
                className="flex items-center justify-center gap-2 w-full rounded-xl font-bold shadow-xl text-white bg-blue-600 hover:bg-blue-500 transition-all active:scale-95 mb-2"
              >
                <RotateCcw style={{ width: 'calc(var(--s) * 0.38)', height: 'calc(var(--s) * 0.38)' }} />
                TRY AGAIN
              </button>
              {hasNextPuzzle && (
                <button
                  onClick={() => {
                    setShowFailModal(false);
                    setFailedAttempts([]);
                    if (levelId !== null) navigateToPuzzle(levelId + 1);
                  }}
                  style={{ padding: 'calc(var(--s) * 0.22) 0', fontSize: 'calc(var(--s) * 0.38)' }}
                  className="flex items-center justify-center gap-2 w-full rounded-xl font-bold shadow-xl text-white bg-slate-700 hover:bg-slate-600 transition-all active:scale-95"
                >
                  SKIP TO NEXT PUZZLE
                  <ChevronRight style={{ width: 'calc(var(--s) * 0.38)', height: 'calc(var(--s) * 0.38)' }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}