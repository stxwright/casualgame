export type Grid = string[][];

export interface GameState {
  grid: Grid;
  targetWords: string[];
  moves: number;
  isSolved: boolean;
}
