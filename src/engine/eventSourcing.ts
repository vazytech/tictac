import type {
  BoardState,
  GameEvent,
  GameOutcome,
  Mark,
  ReconstructedState,
  TurnSnapshot,
} from '../types/game';

export const WINNING_LINES: readonly [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const CELL_COORDS = ['A1', 'B1', 'C1', 'A2', 'B2', 'C2', 'A3', 'B3', 'C3'] as const;

export function createEmptyBoard(): BoardState {
  return [null, null, null, null, null, null, null, null, null];
}

export function cloneBoard(board: BoardState): BoardState {
  return [...board] as BoardState;
}

export function evaluateBoard(board: BoardState): {
  outcome: GameOutcome;
  winningLine: [number, number, number] | null;
} {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const cellA = board[a];
    if (cellA !== null && cellA === board[b] && cellA === board[c]) {
      return {
        outcome: cellA === 'X' ? 'x_won' : 'o_won',
        winningLine: line,
      };
    }
  }

  const isFull = board.every((cell) => cell !== null);
  if (isFull) {
    return { outcome: 'draw', winningLine: null };
  }

  return { outcome: 'in_progress', winningLine: null };
}

/**
 * Pure event-sourcing reducer: reconstructs the current board state and
 * complete turn-by-turn snapshot history by replaying all immutable events
 * in ascending sequence order.
 */
export function replayEvents(events: GameEvent[]): ReconstructedState {
  const sorted = [...events].sort((a, b) => a.seq - b.seq);

  let board: BoardState = createEmptyBoard();
  let currentTurn: Mark = 'X';
  let outcome: GameOutcome = 'in_progress';
  let winningLine: [number, number, number] | null = null;
  let activeTurnNumber = 0;
  let lastMoveCell: number | null = null;

  const initialSnapshot: TurnSnapshot = {
    seq: 0,
    board: cloneBoard(board),
    currentTurn,
    outcome,
    winningLine,
    activeTurnNumber,
    lastMoveCell,
    event: null,
  };

  const snapshotsBySeq = new Map<number, TurnSnapshot>();
  snapshotsBySeq.set(0, initialSnapshot);

  const snapshots: TurnSnapshot[] = [initialSnapshot];

  for (const event of sorted) {
    if (event.type === 'MOVE') {
      if (
        outcome === 'in_progress' &&
        event.cell >= 0 &&
        event.cell <= 8 &&
        board[event.cell] === null &&
        event.player === currentTurn
      ) {
        board = cloneBoard(board);
        board[event.cell] = event.player;
        const evaluation = evaluateBoard(board);
        outcome = evaluation.outcome;
        winningLine = evaluation.winningLine;
        activeTurnNumber += 1;
        lastMoveCell = event.cell;
        if (outcome === 'in_progress') {
          currentTurn = event.player === 'X' ? 'O' : 'X';
        }
      }
    } else if (event.type === 'RESTORE') {
      const target = snapshotsBySeq.get(event.targetSeq);
      if (target) {
        board = cloneBoard(target.board);
        currentTurn = target.currentTurn;
        outcome = target.outcome;
        winningLine = target.winningLine ? [...target.winningLine] : null;
        activeTurnNumber = target.activeTurnNumber;
        lastMoveCell = target.lastMoveCell;
      }
    }

    const snapshot: TurnSnapshot = {
      seq: event.seq,
      board: cloneBoard(board),
      currentTurn,
      outcome,
      winningLine: winningLine ? [...winningLine] : null,
      activeTurnNumber,
      lastMoveCell,
      event,
    };

    snapshotsBySeq.set(event.seq, snapshot);
    snapshots.push(snapshot);
  }

  const latest = snapshots[snapshots.length - 1];

  return {
    board: cloneBoard(latest.board),
    currentTurn: latest.currentTurn,
    outcome: latest.outcome,
    winningLine: latest.winningLine,
    activeTurnNumber: latest.activeTurnNumber,
    latestSeq: latest.seq,
    lastMoveCell: latest.lastMoveCell,
    snapshots,
  };
}
