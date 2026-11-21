interface TopBarProps {
  isSignedIn: boolean;
  userName: string | null;
  onNavigateArena: () => void;
  onOpenNewMatch: () => void;
  onOpenJoinMatch: () => void;
  onOpenRules: () => void;
  onAuthAction: () => void;
  authBusy: boolean;
}

export function TopBar({
  isSignedIn,
  userName,
  onNavigateArena,
  onOpenNewMatch,
  onOpenJoinMatch,
  onOpenRules,
  onAuthAction,
  authBusy,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F2] border-b-2 border-slate-900">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Pixel Brand Wordmark */}
        <button
          type="button"
          onClick={onNavigateArena}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
        >
          TACTIX
        </button>

        {/* Zone 2: Single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-700"
        >
          <button
            type="button"
            onClick={onNavigateArena}
            className="hover:text-slate-950 hover:underline decoration-2 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Arena
          </button>
          <button
            type="button"
            onClick={onOpenNewMatch}
            className="hover:text-slate-950 hover:underline decoration-2 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            New Match
          </button>
          <button
            type="button"
            onClick={onOpenJoinMatch}
            className="hover:text-slate-950 hover:underline decoration-2 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Join Code
          </button>
          <button
            type="button"
            onClick={onOpenRules}
            className="hover:text-slate-950 hover:underline decoration-2 underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
          >
            Rules
          </button>
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {isSignedIn && userName && (
            <span className="hidden sm:inline font-mono text-xs font-medium text-slate-600 truncate max-w-[140px]">
              {userName}
            </span>
          )}
          <button
            type="button"
            onClick={onAuthAction}
            disabled={authBusy}
            className="font-display px-4 py-2 text-xs font-bold text-white bg-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 transition-transform whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
          >
            {isSignedIn ? 'Sign Out' : authBusy ? 'Signing In...' : 'Sign In'}
          </button>
        </div>
      </div>
    </header>
  );
}
