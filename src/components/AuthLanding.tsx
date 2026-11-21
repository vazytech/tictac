import { useState } from 'react';
import { ArrowRight, History, ShieldCheck, Users } from 'lucide-react';

interface AuthLandingProps {
  pendingInviteCode: string | null;
  authBusy: boolean;
  authError: string | null;
  onSignIn: () => void;
}

export function AuthLanding({
  pendingInviteCode,
  authBusy,
  authError,
  onSignIn,
}: AuthLandingProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
        {/* Left Column: Primary Focal Action */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          {pendingInviteCode && (
            <div className="mb-5 p-4 bg-amber-100 border-2 border-slate-900 shadow-[4px_4px_0px_0px_#0F172A] text-sm text-slate-900">
              Match invitation ready for code{' '}
              <span className="font-mono font-bold tabular-nums">
                {pendingInviteCode}
              </span>
              . Sign in with Google to enter the match.
            </div>
          )}

          <p className="font-mono text-xs font-semibold text-slate-600 mb-3">
            Retro Pixel Arena · Event-Sourced State · Real-Time Multiplayer
          </p>

          <h1
            className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-[1.2] mb-5"
            style={{ textWrap: 'balance' }}
          >
            8-bit Tic-Tac-Toe with full turn time-travel
          </h1>

          <p className="text-base text-slate-700 leading-relaxed max-w-[54ch] mb-8">
            Challenge a deterministic Minimax opponent or share a six-character
            match code with a friend. Every move is saved as an immutable
            Firestore event—letting you inspect any past turn and restore the
            board back in time.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-10">
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="font-display inline-flex items-center gap-3 px-6 py-3.5 bg-slate-900 text-white text-xs sm:text-sm font-bold border-2 border-slate-900 shadow-[4px_4px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 transition-transform whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>{authBusy ? 'Connecting...' : 'Continue with Google'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {authError && (
            <p className="text-sm text-red-700 font-medium mb-6" role="alert">
              {authError}
            </p>
          )}

          {/* Pixel-framed feature strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t-2 border-slate-900">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-display text-xs font-bold mb-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Minimax AI</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Alpha-beta search across Apprentice, Tactician, and Grandmaster tiers.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-display text-xs font-bold mb-1.5">
                <Users className="w-4 h-4 text-red-600 shrink-0" />
                <span>Share Codes</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Copy a 6-character code or link to play friends in real time.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-display text-xs font-bold mb-1.5">
                <History className="w-4 h-4 text-slate-800 shrink-0" />
                <span>Turn Replay</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Inspect every move event and roll back the board to any prior turn.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Bespoke Tabletop Visual in Pixel Frame */}
        <div className="lg:col-span-6 flex">
          <div className="w-full bg-[#FAF8F2] border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0F172A] overflow-hidden flex flex-col">
            {!imgFailed ? (
              <img
                src="/src/assets/images/tabletop_tictactoe_board_1795275668066.jpg"
                alt="Architectural ceramic and slate Tic-Tac-Toe tabletop board with cobalt X and vermilion O pieces"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-72 sm:h-96 lg:h-full object-cover"
              />
            ) : (
              <div className="w-full min-h-[340px] lg:h-full bg-[#D8D2C0] flex items-center justify-center p-10">
                <div className="grid grid-cols-3 gap-3 w-56 h-56 p-4 bg-[#FAF8F2] border-4 border-slate-900 shadow-[4px_4px_0px_0px_#0F172A]">
                  {(['X', 'O', null, null, 'X', 'O', 'O', null, 'X'] as const).map(
                    (val, idx) => (
                      <div
                        key={idx}
                        className="bg-white border-2 border-slate-900 flex items-center justify-center font-display text-2xl font-bold"
                      >
                        {val === 'X' && <span className="text-blue-700">X</span>}
                        {val === 'O' && <span className="text-red-600">O</span>}
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
