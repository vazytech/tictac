import { X } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <div className="w-full max-w-lg bg-[#FAF8F2] border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0F172A] p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-slate-900">
          <h2 id="rules-modal-title" className="font-display text-lg font-bold text-slate-900">
            Rules & Replay
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules"
            className="p-1.5 text-slate-900 bg-white border-2 border-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <div>
            <h3 className="font-display text-xs font-bold text-slate-900 mb-1">
              1. Standard Tic-Tac-Toe
            </h3>
            <p>
              Player <span className="font-display font-bold text-blue-700">X</span> always
              moves first, followed by Player{' '}
              <span className="font-display font-bold text-red-600">O</span>. Claim three
              squares in a row—horizontally, vertically, or diagonally—to win.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xs font-bold text-slate-900 mb-1">
              2. Minimax AI Opponent
            </h3>
            <p>
              Solo matches run a deterministic Minimax search with alpha-beta pruning
              locally in your browser. Hard mode plays optimal lines; Easy and Medium
              leave tactical openings.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xs font-bold text-slate-900 mb-1">
              3. Turn History & Restore
            </h3>
            <p>
              Every move is saved as an immutable event document in Firestore. Your board
              replays those events in sequence. Click any entry in the{' '}
              <span className="font-semibold text-slate-900">Turn History</span> sidebar
              to preview that turn, or click{' '}
              <span className="font-semibold text-slate-900">Restore</span> to roll back
              the match to that prior turn.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="font-display px-5 py-2.5 bg-slate-900 text-white text-xs font-bold border-2 border-slate-900 shadow-[3px_3px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
