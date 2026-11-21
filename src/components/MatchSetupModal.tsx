import { useState } from 'react';
import { Bot, Users, X } from 'lucide-react';
import type { AiDifficulty, GameMode, Mark } from '../types/game';

interface MatchSetupModalProps {
  initialTab: 'create' | 'join';
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreateMatch: (params: {
    mode: GameMode;
    aiDifficulty: AiDifficulty;
    playerSymbol: Mark;
  }) => void;
  onJoinMatch: (code: string) => void;
}

export function MatchSetupModal({
  initialTab,
  busy,
  error,
  onClose,
  onCreateMatch,
  onJoinMatch,
}: MatchSetupModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>(initialTab);
  const [mode, setMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('tactician');
  const [symbol, setSymbol] = useState<Mark>('X');
  const [joinCode, setJoinCode] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoinMatch(joinCode);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-modal-title"
    >
      <div className="w-full max-w-md bg-[#FAF8F2] border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0F172A] p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 id="match-modal-title" className="font-display text-lg font-bold text-slate-900">
            {tab === 'create' ? 'New Match' : 'Join Match'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 text-slate-900 bg-white border-2 border-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#D8D2C0] border-2 border-slate-900 mb-6">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`font-display py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'create'
                ? 'bg-slate-900 text-white'
                : 'text-slate-800 hover:bg-white/60'
            }`}
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            className={`font-display py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
              tab === 'join'
                ? 'bg-slate-900 text-white'
                : 'text-slate-800 hover:bg-white/60'
            }`}
          >
            Join Code
          </button>
        </div>

        {tab === 'create' ? (
          <div className="space-y-5">
            <div>
              <span className="block font-display text-xs font-bold text-slate-800 mb-2">
                Opponent
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('ai')}
                  className={`flex items-center gap-2.5 p-3 border-2 border-slate-900 text-left transition-transform cursor-pointer ${
                    mode === 'ai'
                      ? 'bg-slate-900 text-white shadow-[3px_3px_0px_0px_#1D4ED8]'
                      : 'bg-white text-slate-800 shadow-[3px_3px_0px_0px_#0F172A] hover:-translate-y-0.5'
                  }`}
                >
                  <Bot className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-display text-xs font-bold">Minimax AI</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        mode === 'ai' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Solo play
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('pvp')}
                  className={`flex items-center gap-2.5 p-3 border-2 border-slate-900 text-left transition-transform cursor-pointer ${
                    mode === 'pvp'
                      ? 'bg-slate-900 text-white shadow-[3px_3px_0px_0px_#DC2626]'
                      : 'bg-white text-slate-800 shadow-[3px_3px_0px_0px_#0F172A] hover:-translate-y-0.5'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <div>
                    <div className="font-display text-xs font-bold">Friend</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        mode === 'pvp' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      Share code
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {mode === 'ai' && (
              <div>
                <span className="block font-display text-xs font-bold text-slate-800 mb-2">
                  Difficulty
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 bg-[#D8D2C0] border-2 border-slate-900">
                  {(
                    [
                      { id: 'apprentice', label: 'Easy' },
                      { id: 'tactician', label: 'Medium' },
                      { id: 'grandmaster', label: 'Hard' },
                    ] as const
                  ).map((tier) => (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setDifficulty(tier.id)}
                      className={`font-display py-2 px-2 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        difficulty === tier.id
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-800 hover:bg-white/60'
                      }`}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <span className="block font-display text-xs font-bold text-slate-800 mb-2">
                Your Mark
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSymbol('X')}
                  className={`p-3 border-2 border-slate-900 text-left transition-colors cursor-pointer ${
                    symbol === 'X'
                      ? 'bg-blue-100 shadow-[3px_3px_0px_0px_#1D4ED8]'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-display text-lg font-bold text-blue-700">X</div>
                  <div className="text-xs text-slate-600">Plays first</div>
                </button>
                <button
                  type="button"
                  onClick={() => setSymbol('O')}
                  className={`p-3 border-2 border-slate-900 text-left transition-colors cursor-pointer ${
                    symbol === 'O'
                      ? 'bg-red-100 shadow-[3px_3px_0px_0px_#DC2626]'
                      : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="font-display text-lg font-bold text-red-600">O</div>
                  <div className="text-xs text-slate-600">Plays second</div>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs font-medium text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onCreateMatch({ mode, aiDifficulty: difficulty, playerSymbol: symbol })
              }
              className="font-display w-full py-3 bg-slate-900 text-white text-xs font-bold border-2 border-slate-900 shadow-[4px_4px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 transition-transform cursor-pointer"
            >
              {busy
                ? 'Creating Match...'
                : mode === 'ai'
                  ? 'Start AI Match'
                  : 'Create Shareable Match'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="join-code-input"
                className="block font-display text-xs font-bold text-slate-800 mb-2"
              >
                6-Character Match Code
              </label>
              <input
                id="join-code-input"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="K7M3P9"
                maxLength={12}
                autoFocus
                className="w-full px-4 py-3 font-mono text-lg font-bold tracking-widest uppercase bg-white border-2 border-slate-900 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-700"
              />
            </div>

            {error && (
              <p className="text-xs font-medium text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || joinCode.trim().length < 6}
              className="font-display w-full py-3 bg-slate-900 text-white text-xs font-bold border-2 border-slate-900 shadow-[4px_4px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 transition-transform cursor-pointer"
            >
              {busy ? 'Joining Match...' : 'Join Match'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
