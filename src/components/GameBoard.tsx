import { useRef } from 'react';
import { CELL_COORDS } from '../engine/eventSourcing';
import type { BoardState, GameOutcome, Mark } from '../types/game';

interface GameBoardProps {
  board: BoardState;
  currentTurn: Mark;
  outcome: GameOutcome;
  winningLine: [number, number, number] | null;
  lastMoveCell: number | null;
  canInteract: boolean;
  isPreviewing: boolean;
  onCellClick: (cellIndex: number) => void;
}

const LINE_COORDS: Record<string, { x1: number; y1: number; x2: number; y2: number }> = {
  '0,1,2': { x1: 24, y1: 50, x2: 276, y2: 50 },
  '3,4,5': { x1: 24, y1: 150, x2: 276, y2: 150 },
  '6,7,8': { x1: 24, y1: 250, x2: 276, y2: 250 },
  '0,3,6': { x1: 50, y1: 24, x2: 50, y2: 276 },
  '1,4,7': { x1: 150, y1: 24, x2: 150, y2: 276 },
  '2,5,8': { x1: 250, y1: 24, x2: 250, y2: 276 },
  '0,4,8': { x1: 28, y1: 28, x2: 272, y2: 272 },
  '2,4,6': { x1: 272, y1: 28, x2: 28, y2: 272 },
};

/**
 * Crisp 12x12 stepped pixel-art X sprite
 */
function PixelMarkX({ ghost = false }: { ghost?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={`w-12 h-12 sm:w-14 sm:h-14 ${ghost ? 'opacity-25' : 'animate-mark-pop'}`}
      aria-hidden="true"
    >
      {/* Subtle drop shadow pixel layer */}
      {!ghost && (
        <g fill="#0F172A" opacity="0.2" transform="translate(1, 1)">
          <rect x="1" y="1" width="2" height="2" />
          <rect x="2" y="2" width="2" height="2" />
          <rect x="3" y="3" width="2" height="2" />
          <rect x="4" y="4" width="4" height="4" />
          <rect x="7" y="3" width="2" height="2" />
          <rect x="8" y="2" width="2" height="2" />
          <rect x="9" y="1" width="2" height="2" />
          <rect x="3" y="7" width="2" height="2" />
          <rect x="2" y="8" width="2" height="2" />
          <rect x="1" y="9" width="2" height="2" />
          <rect x="7" y="7" width="2" height="2" />
          <rect x="8" y="8" width="2" height="2" />
          <rect x="9" y="9" width="2" height="2" />
        </g>
      )}
      <g fill="#1D4ED8">
        <rect x="1" y="1" width="2" height="2" />
        <rect x="2" y="2" width="2" height="2" />
        <rect x="3" y="3" width="2" height="2" />
        <rect x="4" y="4" width="4" height="4" />
        <rect x="7" y="3" width="2" height="2" />
        <rect x="8" y="2" width="2" height="2" />
        <rect x="9" y="1" width="2" height="2" />
        <rect x="3" y="7" width="2" height="2" />
        <rect x="2" y="8" width="2" height="2" />
        <rect x="1" y="9" width="2" height="2" />
        <rect x="7" y="7" width="2" height="2" />
        <rect x="8" y="8" width="2" height="2" />
        <rect x="9" y="9" width="2" height="2" />
      </g>
      {/* 16-bit top-left specular highlight pixel */}
      {!ghost && (
        <g fill="#60A5FA">
          <rect x="1" y="1" width="1" height="1" />
          <rect x="9" y="1" width="1" height="1" />
          <rect x="5" y="5" width="1" height="1" />
        </g>
      )}
    </svg>
  );
}

/**
 * Crisp 12x12 stepped pixel-art O ring sprite
 */
function PixelMarkO({ ghost = false }: { ghost?: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={`w-12 h-12 sm:w-14 sm:h-14 ${ghost ? 'opacity-25' : 'animate-mark-pop'}`}
      aria-hidden="true"
    >
      {/* Subtle drop shadow pixel layer */}
      {!ghost && (
        <g fill="#0F172A" opacity="0.2" transform="translate(1, 1)">
          <rect x="3" y="1" width="6" height="2" />
          <rect x="2" y="2" width="2" height="2" />
          <rect x="8" y="2" width="2" height="2" />
          <rect x="1" y="3" width="2" height="6" />
          <rect x="9" y="3" width="2" height="6" />
          <rect x="2" y="8" width="2" height="2" />
          <rect x="8" y="8" width="2" height="2" />
          <rect x="3" y="9" width="6" height="2" />
        </g>
      )}
      <g fill="#DC2626">
        <rect x="3" y="1" width="6" height="2" />
        <rect x="2" y="2" width="2" height="2" />
        <rect x="8" y="2" width="2" height="2" />
        <rect x="1" y="3" width="2" height="6" />
        <rect x="9" y="3" width="2" height="6" />
        <rect x="2" y="8" width="2" height="2" />
        <rect x="8" y="8" width="2" height="2" />
        <rect x="3" y="9" width="6" height="2" />
      </g>
      {/* 16-bit top-left specular highlight pixel */}
      {!ghost && (
        <g fill="#FCA5A5">
          <rect x="3" y="1" width="2" height="1" />
          <rect x="2" y="2" width="1" height="1" />
        </g>
      )}
    </svg>
  );
}

export function GameBoard({
  board,
  currentTurn,
  outcome,
  winningLine,
  lastMoveCell,
  canInteract,
  isPreviewing,
  onCellClick,
}: GameBoardProps) {
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const winningSet = new Set(winningLine ?? []);
  const strikeCoord = winningLine ? LINE_COORDS[winningLine.join(',')] : null;
  const strikeColor = outcome === 'x_won' ? '#1D4ED8' : '#DC2626';

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const row = Math.floor(idx / 3);
    const col = idx % 3;
    let nextIdx: number | null = null;

    if (e.key === 'ArrowRight') nextIdx = row * 3 + ((col + 1) % 3);
    else if (e.key === 'ArrowLeft') nextIdx = row * 3 + ((col + 2) % 3);
    else if (e.key === 'ArrowDown') nextIdx = ((row + 1) % 3) * 3 + col;
    else if (e.key === 'ArrowUp') nextIdx = ((row + 2) % 3) * 3 + col;

    if (nextIdx !== null) {
      e.preventDefault();
      cellRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-[392px] aspect-square">
      {/* Retro Console Bezel */}
      <div
        role="grid"
        aria-label="Tic-Tac-Toe 3 by 3 pixel board"
        className={`grid grid-cols-3 grid-rows-3 gap-3 w-full h-full p-3.5 sm:p-4 border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] transition-colors ${
          isPreviewing ? 'bg-amber-200/80' : 'bg-[#D8D2C0]'
        }`}
      >
        {board.map((cell, idx) => {
          const isOccupied = cell !== null;
          const isWinningCell = winningSet.has(idx);
          const isLastMove = lastMoveCell === idx;
          const clickable = canInteract && !isOccupied && outcome === 'in_progress';
          const coord = CELL_COORDS[idx];

          return (
            <button
              key={idx}
              ref={(el) => {
                cellRefs.current[idx] = el;
              }}
              type="button"
              role="gridcell"
              aria-label={`Square ${coord}${cell ? `, occupied by ${cell}` : ', empty'}`}
              disabled={!clickable}
              onClick={() => clickable && onCellClick(idx)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`group relative flex items-center justify-center border-2 border-slate-900 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 ${
                isWinningCell
                  ? outcome === 'x_won'
                    ? 'bg-blue-100 shadow-[2px_2px_0px_0px_#1D4ED8]'
                    : 'bg-red-100 shadow-[2px_2px_0px_0px_#DC2626]'
                  : isLastMove
                    ? 'bg-amber-50 shadow-[3px_3px_0px_0px_#0F172A]'
                    : 'bg-[#FAF8F2] shadow-[3px_3px_0px_0px_#0F172A]'
              } ${
                clickable
                  ? 'cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-white hover:shadow-[4px_4px_0px_0px_#0F172A] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                  : 'cursor-default'
              }`}
            >
              {/* Pixel Coordinate Stamp */}
              <span
                className="absolute top-1 left-1.5 font-mono text-[10px] font-bold text-slate-400 select-none tabular-nums"
                aria-hidden="true"
              >
                {coord}
              </span>

              {/* Last-move corner pixel pip */}
              {isLastMove && !isWinningCell && (
                <span
                  className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 bg-amber-500"
                  aria-hidden="true"
                />
              )}

              {cell === 'X' && <PixelMarkX />}
              {cell === 'O' && <PixelMarkO />}

              {!isOccupied && clickable && (
                <span className="hidden group-hover:flex">
                  {currentTurn === 'X' ? <PixelMarkX ghost /> : <PixelMarkO ghost />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Stepped Winning Strike-Through Overlay */}
      {strikeCoord && (
        <svg
          viewBox="0 0 300 300"
          shapeRendering="crispEdges"
          className="pointer-events-none absolute inset-4 w-[calc(100%-2rem)] h-[calc(100%-2rem)]"
          aria-hidden="true"
        >
          <line
            x1={strikeCoord.x1}
            y1={strikeCoord.y1}
            x2={strikeCoord.x2}
            y2={strikeCoord.y2}
            stroke="#0F172A"
            strokeWidth="12"
            strokeLinecap="square"
            opacity="0.2"
            transform="translate(3, 3)"
            className="animate-strike-draw"
          />
          <line
            x1={strikeCoord.x1}
            y1={strikeCoord.y1}
            x2={strikeCoord.x2}
            y2={strikeCoord.y2}
            stroke={strikeColor}
            strokeWidth="8"
            strokeLinecap="square"
            className="animate-strike-draw"
          />
        </svg>
      )}
    </div>
  );
}
