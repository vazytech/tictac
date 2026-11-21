import type { AiDifficulty, BoardState, Mark } from '../types/game';
import { cloneBoard, evaluateBoard } from './eventSourcing';

function getEmptyIndices(board: BoardState): number[] {
  const indices: number[] = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) indices.push(i);
  }
  return indices;
}

function findImmediateWinningMove(board: BoardState, player: Mark): number | null {
  for (const idx of getEmptyIndices(board)) {
    const next = cloneBoard(board);
    next[idx] = player;
    const { outcome } = evaluateBoard(next);
    if ((player === 'X' && outcome === 'x_won') || (player === 'O' && outcome === 'o_won')) {
      return idx;
    }
  }
  return null;
}

function minimaxScore(
  board: BoardState,
  depth: number,
  isMaximizing: boolean,
  aiPlayer: Mark,
  humanPlayer: Mark,
  alpha: number,
  beta: number,
): number {
  const { outcome } = evaluateBoard(board);
  if (outcome === 'x_won') {
    return aiPlayer === 'X' ? 10 - depth : depth - 10;
  }
  if (outcome === 'o_won') {
    return aiPlayer === 'O' ? 10 - depth : depth - 10;
  }
  if (outcome === 'draw') {
    return 0;
  }

  const empty = getEmptyIndices(board);

  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of empty) {
      board[idx] = aiPlayer;
      const score = minimaxScore(board, depth + 1, false, aiPlayer, humanPlayer, alpha, beta);
      board[idx] = null;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const idx of empty) {
      board[idx] = humanPlayer;
      const score = minimaxScore(board, depth + 1, true, aiPlayer, humanPlayer, alpha, beta);
      board[idx] = null;
      if (score < best) best = score;
      if (best < beta) beta = best;
      if (beta <= alpha) break;
    }
    return best;
  }
}

interface ScoredMove {
  cell: number;
  score: number;
}

function scoreAllMoves(board: BoardState, aiPlayer: Mark): ScoredMove[] {
  const humanPlayer: Mark = aiPlayer === 'X' ? 'O' : 'X';
  const empty = getEmptyIndices(board);

  // Fast opening heuristic when board is completely empty (saves evaluating 9! nodes needlessly)
  if (empty.length === 9) {
    return [
      { cell: 4, score: 1 },
      { cell: 0, score: 1 },
      { cell: 2, score: 1 },
      { cell: 6, score: 1 },
      { cell: 8, score: 1 },
      { cell: 1, score: 0 },
      { cell: 3, score: 0 },
      { cell: 5, score: 0 },
      { cell: 7, score: 0 },
    ];
  }

  const scored: ScoredMove[] = [];
  const working = cloneBoard(board);

  for (const idx of empty) {
    working[idx] = aiPlayer;
    const score = minimaxScore(working, 0, false, aiPlayer, humanPlayer, -Infinity, Infinity);
    working[idx] = null;
    scored.push({ cell: idx, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Computes the AI opponent's next move purely algorithmically using Minimax
 * with alpha-beta pruning. No LLM or external API calls are ever made.
 */
export function computeAiMove(
  board: BoardState,
  aiPlayer: Mark,
  difficulty: AiDifficulty,
): number | null {
  const empty = getEmptyIndices(board);
  if (empty.length === 0) return null;

  const humanPlayer: Mark = aiPlayer === 'X' ? 'O' : 'X';

  if (difficulty === 'apprentice') {
    const winNow = findImmediateWinningMove(board, aiPlayer);
    if (winNow !== null) return winNow;

    if (Math.random() < 0.65) {
      const blockNow = findImmediateWinningMove(board, humanPlayer);
      if (blockNow !== null) return blockNow;
    }

    return empty[Math.floor(Math.random() * empty.length)];
  }

  const scored = scoreAllMoves(board, aiPlayer);

  if (difficulty === 'tactician') {
    const winNow = findImmediateWinningMove(board, aiPlayer);
    if (winNow !== null) return winNow;

    const blockNow = findImmediateWinningMove(board, humanPlayer);
    if (blockNow !== null) return blockNow;

    if (scored.length > 1 && Math.random() < 0.28) {
      return scored[1].cell;
    }
  }

  // Grandmaster: pick randomly among tied optimal Minimax moves
  const topScore = scored[0].score;
  const bestMoves = scored.filter((m) => m.score === topScore);
  return bestMoves[Math.floor(Math.random() * bestMoves.length)].cell;
}
