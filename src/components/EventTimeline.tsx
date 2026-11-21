import { Eye, RotateCcw } from 'lucide-react';
import { CELL_COORDS } from '../engine/eventSourcing';
import type { BoardState, TurnSnapshot } from '../types/game';

interface EventTimelineProps {
  snapshots: TurnSnapshot[];
  previewSeq: number | null;
  latestSeq: number;
  currentTurnNumber: number;
  currentUserUid: string;
  isClosed: boolean;
  isWaiting: boolean;
  restoringSeq: number | null;
  onSelectPreview: (seq: number | null) => void;
  onRestoreToSeq: (targetSeq: number) => void;
}

function PixelMiniBoard({ board, highlightCell }: { board: BoardState; highlightCell: number | null }) {
  return (
    <div
      className="grid grid-cols-3 gap-0.5 w-9 h-9 p-1 bg-[#D8D2C0] border-2 border-slate-900 shrink-0"
      aria-hidden="true"
    >
      {board.map((cell, i) => (
        <div
          key={i}
          className={`flex items-center justify-center font-display text-[7px] font-bold leading-none ${
            highlightCell === i ? 'bg-amber-100' : 'bg-[#FAF8F2]'
          }`}
        >
          {cell === 'X' && <span className="text-blue-700">X</span>}
          {cell === 'O' && <span className="text-red-600">O</span>}
        </div>
      ))}
    </div>
  );
}

function formatMoveTimestamp(snapshot: TurnSnapshot): string {
  const ts = snapshot.event?.createdAt;
  if (!ts || typeof ts.toDate !== 'function') {
    return snapshot.seq === 0 ? 'Match start' : 'Syncing...';
  }
  const date = ts.toDate();
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const timeStr = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  if (sameDay) {
    return timeStr;
  }
  const dateStr = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  return `${dateStr}, ${timeStr}`;
}

export function EventTimeline({
  snapshots,
  previewSeq,
  latestSeq,
  currentTurnNumber,
  currentUserUid,
  isClosed,
  isWaiting,
  restoringSeq,
  onSelectPreview,
  onRestoreToSeq,
}: EventTimelineProps) {
  const ordered = [...snapshots].reverse();
  const activePreviewSeq = previewSeq ?? latestSeq;
  const displayedSnap =
    snapshots.find((s) => s.seq === activePreviewSeq) ?? snapshots[snapshots.length - 1];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 pb-3 mb-3 border-b-2 border-slate-900">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900 tracking-tight">
            Turn History
          </h2>
          <p className="font-mono text-xs text-slate-600 mt-1 tabular-nums">
            Replay Turn {displayedSnap?.activeTurnNumber ?? currentTurnNumber} ·{' '}
            {snapshots.length - 1} {snapshots.length - 1 === 1 ? 'event' : 'events'}
          </p>
        </div>

        {previewSeq !== null && previewSeq !== latestSeq && (
          <button
            type="button"
            onClick={() => onSelectPreview(null)}
            className="font-display px-2.5 py-1.5 text-[11px] font-bold text-slate-900 bg-amber-200 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0F172A] hover:bg-amber-300 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform whitespace-nowrap shrink-0 cursor-pointer"
          >
            Live State
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[440px]">
        {ordered.map((snap) => {
          const isLatest = snap.seq === latestSeq;
          const isSelected = snap.seq === activePreviewSeq;
          const evt = snap.event;
          const isRestoreEvent = evt?.type === 'RESTORE';
          const canRestore = !isLatest && !isClosed && !isWaiting;

          let actionLabel = 'Initial Empty Board';
          let whoLabel = 'System · Turn 0';
          const whenLabel = formatMoveTimestamp(snap);

          if (evt) {
            const isSelf = evt.actorUid === currentUserUid && !evt.isAiMove;
            const actorDisplay = evt.isAiMove
              ? 'Minimax AI'
              : isSelf
                ? `${evt.actorName} (You)`
                : evt.actorName;

            if (evt.type === 'MOVE') {
              const coord = CELL_COORDS[evt.cell] ?? '?';
              actionLabel = `${evt.player} → ${coord}`;
              whoLabel = `By ${actorDisplay} · Turn ${snap.activeTurnNumber}`;
            } else {
              actionLabel = `Restored to #${evt.targetSeq}`;
              whoLabel = `By ${actorDisplay} · Turn ${snap.activeTurnNumber}`;
            }
          }

          return (
            <div
              key={snap.seq}
              className={`flex items-center justify-between gap-3 p-2.5 border-2 transition-colors ${
                isSelected
                  ? 'bg-amber-50 border-slate-900 shadow-[3px_3px_0px_0px_#0F172A]'
                  : 'bg-[#FAF8F2] border-slate-300 hover:border-slate-900'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectPreview(isLatest ? null : snap.seq)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
              >
                <PixelMiniBoard
                  board={snap.board}
                  highlightCell={evt?.type === 'MOVE' ? evt.cell : null}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500 tabular-nums">
                      #{snap.seq}
                    </span>
                    <span
                      className={`font-display text-xs font-bold truncate ${
                        isRestoreEvent
                          ? 'text-amber-800'
                          : evt?.player === 'X'
                            ? 'text-blue-700'
                            : evt?.player === 'O'
                              ? 'text-red-600'
                              : 'text-slate-900'
                      }`}
                    >
                      {actionLabel}
                    </span>
                    {isLatest && (
                      <span className="font-mono text-[11px] font-bold text-emerald-700 whitespace-nowrap">
                        · LIVE
                      </span>
                    )}
                    {!isLatest && isSelected && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-amber-800 whitespace-nowrap">
                        · <Eye className="w-3 h-3" /> VIEW
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-700 truncate mt-0.5">
                    {whoLabel}
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5 tabular-nums">
                    When: {whenLabel}
                  </div>
                </div>
              </button>

              {canRestore && (
                <button
                  type="button"
                  onClick={() => onRestoreToSeq(snap.seq)}
                  disabled={restoringSeq !== null}
                  title={`Restore game state to Event #${snap.seq}`}
                  className="font-display inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-slate-900 bg-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0F172A] hover:bg-slate-900 hover:text-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{restoringSeq === snap.seq ? '...' : 'Restore'}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
