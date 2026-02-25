export type Grid = string[][];

export type MoveType = 'row' | 'col';

export interface Move {
  type: MoveType;
  idx: number;
  dir: number;
}

export type Feedback = 'correct' | 'partial' | 'incorrect';

export interface Attempt {
  moves: Move[];
  feedback: Feedback[];
}

export interface GameState {
  levelId: string;
  grid: Grid;
  attempts: Attempt[];
  currentAttemptMoves: Move[];
  currentAttemptFeedback: Feedback[];
  movesRemaining: number;
  isSolved: boolean;
  lastMoveType: MoveType | null;
}
