import type { Timestamp } from 'firebase/firestore';

export type Mark = 'X' | 'O';
export type CellValue = Mark | null;
export type BoardState = [
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
  CellValue,
];

export type GameMode = 'ai' | 'pvp';
export type AiDifficulty = 'apprentice' | 'tactician' | 'grandmaster';
export type MatchStatus = 'waiting' | 'active' | 'closed';
export type GameOutcome = 'in_progress' | 'x_won' | 'o_won' | 'draw';

export interface GameMatch {
  gameId: string;
  mode: GameMode;
  aiDifficulty: AiDifficulty | 'none';
  creatorUid: string;
  playerXUid: string;
  playerXName: string;
  playerOUid: string;
  playerOName: string;
  participantUids: string[];
  status: MatchStatus;
  eventCount: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface GameEvent {
  id: string;
  seq: number;
  type: 'MOVE' | 'RESTORE';
  actorUid: string;
  actorName: string;
  player: 'X' | 'O' | 'NONE';
  cell: number;
  targetSeq: number;
  isAiMove: boolean;
  participantUids: string[];
  createdAt: Timestamp | null;
}

export interface TurnSnapshot {
  seq: number;
  board: BoardState;
  currentTurn: Mark;
  outcome: GameOutcome;
  winningLine: [number, number, number] | null;
  activeTurnNumber: number;
  lastMoveCell: number | null;
  event: GameEvent | null;
}

export interface ReconstructedState {
  board: BoardState;
  currentTurn: Mark;
  outcome: GameOutcome;
  winningLine: [number, number, number] | null;
  activeTurnNumber: number;
  latestSeq: number;
  lastMoveCell: number | null;
  snapshots: TurnSnapshot[];
}
