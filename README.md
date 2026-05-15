# WordWrap

WordWrap is a minimalist, grid-based word puzzle game. The goal is to shift rows and columns to arrange letters into four words across and four words down.

## How to Play

- **Objective:** Form a valid 4x4 grid of words (4 across, 4 down).
- **Controls:** Click the arrows around the board to shift a row or column by one tile.
- **Constraints:**
  - Each attempt gives you **2 moves**.
  - You have **6 attempts** per puzzle.
  - You cannot shift the same axis (row or column) twice in a row.
- **Feedback:**
  - **Green:** The move is part of the solution.
  - **Yellow:** The correct row/column was shifted, but in the wrong direction.
  - **Red:** This row/column does not need shifting.

## Development

This project is a React SPA built with Vite and Tailwind CSS, designed specifically for lightweight hosting on GitHub Pages.

### Local Setup

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Start the dev server: `npm run dev`

### Project Structure

- `src/App.tsx`: Main game logic and UI.
- `public/puzzles.json`: The puzzle database.
- `vite.config.js`: Optimized for GitHub Pages sub-path hosting and hash-routing.

## Credits

Created with ❤️ for word game enthusiasts. Hosted for free on GitHub Pages.
