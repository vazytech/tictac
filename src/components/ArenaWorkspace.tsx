import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  Link2,
  Plus,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { replayEvents } from '../engine/eventSourcing';
import { computeAiMove } from '../engine/minimax';
import {
  appendMoveEvent,
  appendRestoreEvent,
  closeMatch,
  formatUserError,
  subscribeToMatch,
  subscribeToMatchEvents,
} from '../services/gameService';
import type {
  AiDifficulty,
  GameEvent,
  GameMatch,
  GameMode,
  Mark,
} from '../types/game';
import {
  playDrawSound,
  playMoveSound,
  playRestoreSound,
  playWinSound,
} from '../utils/sound';
import { EventTimeline } from './EventTimeline';
import { GameBoard } from './GameBoard';

interface ArenaWorkspaceProps {
  user: User;
  matches: GameMatch[];
  activeMatchId: string | null;
  muted: boolean;
  onToggleMute: () => void;
  onSelectMatch: (gameId: string | null) => void;
  onOpenNewMatch: () => void;
  onOpenJoinMatch: () => void;
  onQuickCreateMatch: (params: {
    mode: GameMode;
    aiDifficulty: AiDifficulty;
    playerSymbol: Mark;
  }) => Promise<void>;
  onQuickJoinMatch: (code: string) => Promise<void>;
}

export function ArenaWorkspace({
  user,
  matches,
  activeMatchId,
  muted,
  onToggleMute,
  onSelectMatch,
  onOpenNewMatch,
  onOpenJoinMatch,
  onQuickCreateMatch,
  onQuickJoinMatch,
}: ArenaWorkspaceProps) {
  const [activeMatch, setActiveMatch] = useState<GameMatch | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [previewSeq, setPreviewSeq] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoringSeq, setRestoringSeq] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const [sideTab, setSideTab] = useState<'timeline' | 'matches'>('timeline');

  // Inline lobby form state when no match is active
  const [lobbyMode, setLobbyMode] = useState<GameMode>('ai');
  const [lobbyDifficulty, setLobbyDifficulty] = useState<AiDifficulty>('tactician');
  const [lobbySymbol, setLobbySymbol] = useState<Mark>('X');
  const [lobbyJoinCode, setLobbyJoinCode] = useState('');
  const [lobbyBusy, setLobbyBusy] = useState(false);
  const [lobbyError, setLobbyError] = useState<string | null>(null);

  const aiScheduledKeyRef = useRef<string | null>(null);
  const prevOutcomeRef = useRef<string>('in_progress');

  // Subscribe to active match and its event-sourced subcollection
  useEffect(() => {
    if (!activeMatchId) {
      setActiveMatch(null);
      setEvents([]);
      setPreviewSeq(null);
      setLoadingMatch(false);
      return;
    }

    setLoadingMatch(true);
    setPreviewSeq(null);
    setActionError(null);
    aiScheduledKeyRef.current = null;
    prevOutcomeRef.current = 'in_progress';

    const unsubMatch = subscribeToMatch(activeMatchId, (match) => {
      setActiveMatch(match);
      setLoadingMatch(false);
    });

    const unsubEvents = subscribeToMatchEvents(activeMatchId, user.uid, (evts) => {
      setEvents(evts);
    });

    return () => {
      unsubMatch();
      unsubEvents();
    };
  }, [activeMatchId, user.uid]);

  const reconstructed = useMemo(() => replayEvents(events), [events]);

  // Reset preview if the live sequence moves past or events reload
  useEffect(() => {
    if (previewSeq !== null && previewSeq >= reconstructed.latestSeq) {
      setPreviewSeq(null);
    }
  }, [previewSeq, reconstructed.latestSeq]);

  // Play outcome chimes on live state transitions
  useEffect(() => {
    const prev = prevOutcomeRef.current;
    const next = reconstructed.outcome;
    if (prev === 'in_progress' && next !== 'in_progress') {
      if (next === 'x_won' || next === 'o_won') {
        playWinSound(muted);
      } else if (next === 'draw') {
        playDrawSound(muted);
      }
    }
    prevOutcomeRef.current = next;
  }, [reconstructed.outcome, muted]);

  // Trigger deterministic Minimax AI move automatically when it is the AI's turn
  useEffect(() => {
    if (!activeMatch) return;
    if (activeMatch.mode !== 'ai' || activeMatch.status !== 'active') return;
    if (reconstructed.latestSeq !== activeMatch.eventCount) return;
    if (previewSeq !== null) return;
    if (reconstructed.outcome !== 'in_progress') return;
    if (isSubmitting) return;

    const aiMark: Mark = activeMatch.playerXUid === 'AI_MINIMAX' ? 'X' : 'O';
    if (reconstructed.currentTurn !== aiMark) return;

    const scheduleKey = `${activeMatch.gameId}:${activeMatch.eventCount}`;
    if (aiScheduledKeyRef.current === scheduleKey) return;
    aiScheduledKeyRef.current = scheduleKey;

    const difficulty: AiDifficulty =
      activeMatch.aiDifficulty === 'none' ? 'tactician' : activeMatch.aiDifficulty;

    const timer = window.setTimeout(async () => {
      const cell = computeAiMove(reconstructed.board, aiMark, difficulty);
      if (cell === null) return;

      setIsSubmitting(true);
      setActionError(null);
      try {
        await appendMoveEvent({
          match: activeMatch,
          user,
          player: aiMark,
          cell,
          isAiMove: true,
        });
        playMoveSound(aiMark, muted);
      } catch (err) {
        aiScheduledKeyRef.current = null;
        setActionError(formatUserError(err, 'Failed to record AI move.'));
      } finally {
        setIsSubmitting(false);
      }
    }, 550);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeMatch, previewSeq, reconstructed, isSubmitting, user, muted]);

  const displayedSnapshot = useMemo(() => {
    if (previewSeq !== null) {
      const found = reconstructed.snapshots.find((s) => s.seq === previewSeq);
      if (found) return found;
    }
    return reconstructed.snapshots[reconstructed.snapshots.length - 1];
  }, [reconstructed.snapshots, previewSeq]);

  const isPreviewing = previewSeq !== null && previewSeq !== reconstructed.latestSeq;

  const userMark: Mark | null = useMemo(() => {
    if (!activeMatch) return null;
    if (activeMatch.playerXUid === user.uid) return 'X';
    if (activeMatch.playerOUid === user.uid) return 'O';
    return null;
  }, [activeMatch, user.uid]);

  const canInteract = Boolean(
    activeMatch &&
      activeMatch.status === 'active' &&
      reconstructed.latestSeq === activeMatch.eventCount &&
      !isPreviewing &&
      !isSubmitting &&
      reconstructed.outcome === 'in_progress' &&
      userMark !== null &&
      reconstructed.currentTurn === userMark,
  );

  const handleCellClick = async (cell: number) => {
    if (!activeMatch || !canInteract || !userMark) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      await appendMoveEvent({
        match: activeMatch,
        user,
        player: userMark,
        cell,
        isAiMove: false,
      });
      playMoveSound(userMark, muted);
    } catch (err) {
      setActionError(formatUserError(err, 'Could not submit move.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestoreToSeq = async (targetSeq: number) => {
    if (!activeMatch || activeMatch.status !== 'active') return;
    setRestoringSeq(targetSeq);
    setActionError(null);
    aiScheduledKeyRef.current = null;
    try {
      await appendRestoreEvent({
        match: activeMatch,
        user,
        targetSeq,
      });
      setPreviewSeq(null);
      playRestoreSound(muted);
    } catch (err) {
      setActionError(formatUserError(err, 'Could not restore turn.'));
    } finally {
      setRestoringSeq(null);
    }
  };

  const handleCopy = async (type: 'code' | 'link') => {
    if (!activeMatch) return;
    const text =
      type === 'code'
        ? activeMatch.gameId
        : `${window.location.origin}/?game=${activeMatch.gameId}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setActionError('Clipboard access unavailable. Please copy the code manually.');
    }
  };

  const handleRematch = async () => {
    if (!activeMatch) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const symbol: Mark = userMark ?? 'X';
      const diff: AiDifficulty =
        activeMatch.aiDifficulty === 'none' ? 'tactician' : activeMatch.aiDifficulty;
      await onQuickCreateMatch({
        mode: activeMatch.mode,
        aiDifficulty: diff,
        playerSymbol: symbol,
      });
    } catch (err) {
      setActionError(formatUserError(err, 'Failed to start rematch.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveMatch = async () => {
    if (!activeMatch || activeMatch.status === 'closed') return;
    setIsSubmitting(true);
    try {
      await closeMatch(activeMatch.gameId);
    } catch (err) {
      setActionError(formatUserError(err, 'Could not archive match.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lobby create / join handlers
  const handleLobbyCreate = async () => {
    setLobbyBusy(true);
    setLobbyError(null);
    try {
      await onQuickCreateMatch({
        mode: lobbyMode,
        aiDifficulty: lobbyDifficulty,
        playerSymbol: lobbySymbol,
      });
    } catch (err) {
      setLobbyError(formatUserError(err, 'Could not create match.'));
    } finally {
      setLobbyBusy(false);
    }
  };

  const handleLobbyJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLobbyBusy(true);
    setLobbyError(null);
    try {
      await onQuickJoinMatch(lobbyJoinCode);
      setLobbyJoinCode('');
    } catch (err) {
      setLobbyError(formatUserError(err, 'Could not join match.'));
    } finally {
      setLobbyBusy(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Lobby View (no active match selected)
  // ---------------------------------------------------------------------------
  if (!activeMatchId) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Start or Join Match */}
          <section className="lg:col-span-7 bg-[#FAF8F2] border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] p-6 sm:p-8">
            <div className="mb-6 pb-4 border-b-2 border-slate-900">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Start a Match
              </h1>
              <p className="text-sm text-slate-600 mt-1.5">
                Play solo against Minimax AI or generate a share code for a friend.
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <span className="block font-display text-xs font-bold text-slate-800 mb-2">
                  Match Mode
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLobbyMode('ai')}
                    className={`flex items-center gap-3 p-4 border-2 border-slate-900 text-left transition-transform cursor-pointer ${
                      lobbyMode === 'ai'
                        ? 'bg-slate-900 text-white shadow-[4px_4px_0px_0px_#1D4ED8]'
                        : 'bg-white text-slate-900 shadow-[4px_4px_0px_0px_#0F172A] hover:-translate-y-0.5'
                    }`}
                  >
                    <Bot className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-display text-xs font-bold">Vs Minimax AI</div>
                      <div
                        className={`text-xs mt-0.5 ${
                          lobbyMode === 'ai' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        Deterministic search opponent
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLobbyMode('pvp')}
                    className={`flex items-center gap-3 p-4 border-2 border-slate-900 text-left transition-transform cursor-pointer ${
                      lobbyMode === 'pvp'
                        ? 'bg-slate-900 text-white shadow-[4px_4px_0px_0px_#DC2626]'
                        : 'bg-white text-slate-900 shadow-[4px_4px_0px_0px_#0F172A] hover:-translate-y-0.5'
                    }`}
                  >
                    <Users className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-display text-xs font-bold">Vs Friend</div>
                      <div
                        className={`text-xs mt-0.5 ${
                          lobbyMode === 'pvp' ? 'text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        Shareable 6-character code
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {lobbyMode === 'ai' && (
                <div>
                  <span className="block font-display text-xs font-bold text-slate-800 mb-2">
                    AI Difficulty
                  </span>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-[#D8D2C0] border-2 border-slate-900">
                    {(
                      [
                        { id: 'apprentice', label: 'Apprentice' },
                        { id: 'tactician', label: 'Tactician' },
                        { id: 'grandmaster', label: 'Grandmaster' },
                      ] as const
                    ).map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setLobbyDifficulty(tier.id)}
                        className={`font-display py-2 px-2 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                          lobbyDifficulty === tier.id
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
                  Choose Your Mark
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLobbySymbol('X')}
                    className={`p-3.5 border-2 border-slate-900 text-left transition-colors cursor-pointer ${
                      lobbySymbol === 'X'
                        ? 'bg-blue-100 shadow-[3px_3px_0px_0px_#1D4ED8]'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-display text-lg font-bold text-blue-700 mr-2">
                      X
                    </span>
                    <span className="text-xs font-medium text-slate-700">First turn</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLobbySymbol('O')}
                    className={`p-3.5 border-2 border-slate-900 text-left transition-colors cursor-pointer ${
                      lobbySymbol === 'O'
                        ? 'bg-red-100 shadow-[3px_3px_0px_0px_#DC2626]'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-display text-lg font-bold text-red-600 mr-2">
                      O
                    </span>
                    <span className="text-xs font-medium text-slate-700">Second turn</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={lobbyBusy}
                onClick={handleLobbyCreate}
                className="font-display w-full py-3.5 bg-slate-900 text-white text-xs sm:text-sm font-bold border-2 border-slate-900 shadow-[4px_4px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 transition-transform cursor-pointer"
              >
                {lobbyBusy
                  ? 'Creating Match...'
                  : lobbyMode === 'ai'
                    ? 'Launch Minimax Match'
                    : 'Create Multiplayer Match'}
              </button>

              {/* Join existing code divider */}
              <div className="pt-6 border-t-2 border-slate-900">
                <form onSubmit={handleLobbyJoin} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={lobbyJoinCode}
                    onChange={(e) => setLobbyJoinCode(e.target.value.toUpperCase())}
                    placeholder="Enter friend's code (e.g. K7M3P9)"
                    maxLength={12}
                    aria-label="Friend match code"
                    className="flex-1 px-4 py-2.5 font-mono text-sm font-bold uppercase tracking-wider bg-white border-2 border-slate-900 text-slate-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-blue-700"
                  />
                  <button
                    type="submit"
                    disabled={lobbyBusy || lobbyJoinCode.trim().length < 6}
                    className="font-display px-5 py-2.5 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0F172A] text-slate-900 text-xs font-bold hover:bg-slate-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Join Match
                  </button>
                </form>
                {lobbyError && (
                  <p className="text-xs font-medium text-red-700 mt-2" role="alert">
                    {lobbyError}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Right: Recent Matches */}
          <aside className="lg:col-span-5 bg-[#FAF8F2] border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] p-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-slate-900">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Your Matches
                </h2>
                <p className="font-mono text-xs text-slate-600 mt-0.5 tabular-nums">
                  {matches.length} {matches.length === 1 ? 'match' : 'matches'} saved
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenJoinMatch}
                className="font-display text-xs font-bold text-blue-700 hover:underline cursor-pointer"
              >
                Join Code
              </button>
            </div>

            {matches.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-600">
                  No matches yet. Start a solo AI game or create a friend match to
                  record your first event log.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {matches.map((m) => (
                  <button
                    key={m.gameId}
                    type="button"
                    onClick={() => onSelectMatch(m.gameId)}
                    className="w-full flex items-center justify-between gap-3 p-3.5 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0F172A] hover:bg-amber-50 text-left transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                          {m.gameId}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {m.playerXName} vs {m.playerOName}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 mt-1 tabular-nums">
                        {m.mode === 'ai' ? `AI (${m.aiDifficulty})` : 'Multiplayer'} ·{' '}
                        {m.eventCount} events ·{' '}
                        <span
                          className={
                            m.status === 'waiting'
                              ? 'text-amber-800 font-bold'
                              : m.status === 'active'
                                ? 'text-emerald-700 font-bold'
                                : 'text-slate-500'
                          }
                        >
                          {m.status === 'waiting'
                            ? 'WAITING'
                            : m.status === 'active'
                              ? 'ACTIVE'
                              : 'ARCHIVED'}
                        </span>
                      </div>
                    </div>
                    <span className="font-display text-xs font-bold text-slate-900 whitespace-nowrap shrink-0">
                      Open
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Loading / Missing Match Guard
  // ---------------------------------------------------------------------------
  if (loadingMatch) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#FAF8F2] border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] p-10 text-center">
          <p className="font-mono text-sm text-slate-700">
            Loading match <span className="font-bold">{activeMatchId}</span>...
          </p>
        </div>
      </main>
    );
  }

  if (!activeMatch) {
    return (
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className="bg-[#FAF8F2] border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] p-10 text-center max-w-lg mx-auto">
          <h1 className="font-display text-xl font-bold text-slate-900 mb-2">
            Match Unavailable
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            This match could not be found or is restricted to its two participants.
          </p>
          <button
            type="button"
            onClick={() => onSelectMatch(null)}
            className="font-display px-5 py-2.5 bg-slate-900 text-white text-xs font-bold border-2 border-slate-900 shadow-[3px_3px_0px_0px_#1D4ED8] hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Back to Lobby
          </button>
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Active Match Arena
  // ---------------------------------------------------------------------------
  const isAiThinking =
    activeMatch.mode === 'ai' &&
    activeMatch.status === 'active' &&
    !isPreviewing &&
    reconstructed.outcome === 'in_progress' &&
    ((reconstructed.currentTurn === 'X' && activeMatch.playerXUid === 'AI_MINIMAX') ||
      (reconstructed.currentTurn === 'O' && activeMatch.playerOUid === 'AI_MINIMAX'));

  let turnStatusText = '';
  if (activeMatch.status === 'waiting') {
    turnStatusText = 'Waiting for friend to join';
  } else if (isPreviewing) {
    turnStatusText = `Previewing Event #${displayedSnapshot.seq} · Turn ${displayedSnapshot.activeTurnNumber}`;
  } else if (reconstructed.outcome === 'x_won') {
    turnStatusText =
      activeMatch.playerXUid === user.uid
        ? 'Victory — You Win (X)'
        : `${activeMatch.playerXName} Wins (X)`;
  } else if (reconstructed.outcome === 'o_won') {
    turnStatusText =
      activeMatch.playerOUid === user.uid
        ? 'Victory — You Win (O)'
        : `${activeMatch.playerOName} Wins (O)`;
  } else if (reconstructed.outcome === 'draw') {
    turnStatusText = 'Draw Match — Board Full';
  } else if (isAiThinking) {
    turnStatusText = 'Minimax AI is thinking...';
  } else if (reconstructed.currentTurn === userMark) {
    turnStatusText = `Your Turn (${userMark})`;
  } else {
    const oppName =
      reconstructed.currentTurn === 'X'
        ? activeMatch.playerXName
        : activeMatch.playerOName;
    turnStatusText = `Waiting for ${oppName} (${reconstructed.currentTurn})`;
  }

  return (
    <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 lg:py-10">
      {/* Match Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => onSelectMatch(null)}
            className="font-display inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-slate-900 bg-[#FAF8F2] border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0F172A] hover:bg-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Matches</span>
          </button>
          <div className="font-mono text-xs sm:text-sm text-slate-700 truncate">
            <span className="font-bold text-slate-900 tabular-nums">
              {activeMatch.gameId}
            </span>
            <span className="mx-2 text-slate-400">·</span>
            <span>
              {activeMatch.mode === 'ai'
                ? `Vs Minimax AI (${activeMatch.aiDifficulty})`
                : 'Multiplayer Match'}
            </span>
            {activeMatch.status === 'closed' && (
              <>
                <span className="mx-2 text-slate-400">·</span>
                <span className="text-slate-500">Archived</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeMatch.mode === 'pvp' && (
            <>
              <button
                type="button"
                onClick={() => handleCopy('code')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-[#FAF8F2] border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0F172A] hover:bg-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform whitespace-nowrap cursor-pointer"
              >
                {copiedType === 'code' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span className="font-mono tabular-nums">
                  {copiedType === 'code' ? 'Copied' : activeMatch.gameId}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleCopy('link')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-[#FAF8F2] border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0F172A] hover:bg-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform whitespace-nowrap cursor-pointer"
              >
                {copiedType === 'link' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                ) : (
                  <Link2 className="w-3.5 h-3.5" />
                )}
                <span>{copiedType === 'link' ? 'Link Copied' : 'Copy Link'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
            className="p-2 text-slate-900 bg-[#FAF8F2] border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0F172A] hover:bg-white active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenNewMatch}
            className="font-display inline-flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold text-white bg-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Match</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Center Dominant Pixel Board Zone */}
        <section className="lg:col-span-7 bg-[#FAF8F2] border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] p-5 sm:p-8">
          {/* Player Cards Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              className={`p-3.5 border-2 border-slate-900 transition-colors ${
                displayedSnapshot.outcome === 'in_progress' &&
                displayedSnapshot.currentTurn === 'X' &&
                activeMatch.status === 'active'
                  ? 'bg-blue-100 shadow-[3px_3px_0px_0px_#1D4ED8]'
                  : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-blue-700">
                  Player X
                </span>
                {displayedSnapshot.outcome === 'in_progress' &&
                  displayedSnapshot.currentTurn === 'X' &&
                  activeMatch.status === 'active' && (
                    <span className="font-mono text-[11px] font-bold text-blue-800">
                      ACTIVE
                    </span>
                  )}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate mt-1">
                {activeMatch.playerXName}
                {activeMatch.playerXUid === user.uid ? ' (You)' : ''}
              </div>
            </div>

            <div
              className={`p-3.5 border-2 border-slate-900 transition-colors ${
                displayedSnapshot.outcome === 'in_progress' &&
                displayedSnapshot.currentTurn === 'O' &&
                activeMatch.status === 'active'
                  ? 'bg-red-100 shadow-[3px_3px_0px_0px_#DC2626]'
                  : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-red-600">
                  Player O
                </span>
                {displayedSnapshot.outcome === 'in_progress' &&
                  displayedSnapshot.currentTurn === 'O' &&
                  activeMatch.status === 'active' && (
                    <span className="font-mono text-[11px] font-bold text-red-700">
                      ACTIVE
                    </span>
                  )}
              </div>
              <div className="text-sm font-semibold text-slate-900 truncate mt-1">
                {activeMatch.playerOName}
                {activeMatch.playerOUid === user.uid ? ' (You)' : ''}
              </div>
            </div>
          </div>

          {/* Explicit Text Turn Banner */}
          <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b-2 border-slate-900">
            <div className="font-display text-xs sm:text-sm font-bold text-slate-900">
              {turnStatusText}
            </div>
            <div className="font-mono text-xs font-bold text-slate-600 tabular-nums whitespace-nowrap">
              TURN {displayedSnapshot.activeTurnNumber} / 9
            </div>
          </div>

          {/* Preview Mode Callout */}
          {isPreviewing && (
            <div className="mb-6 p-3.5 bg-amber-100 border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0F172A] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-900">
                Viewing Event #{displayedSnapshot.seq} snapshot. Live board is at Event
                #{reconstructed.latestSeq}.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewSeq(null)}
                  className="font-display px-3 py-1.5 text-[11px] font-bold text-slate-900 bg-white border-2 border-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Back to Live
                </button>
                {activeMatch.status === 'active' && (
                  <button
                    type="button"
                    disabled={restoringSeq !== null}
                    onClick={() => handleRestoreToSeq(displayedSnapshot.seq)}
                    className="font-display inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-slate-900 border-2 border-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>
                      {restoringSeq === displayedSnapshot.seq
                        ? 'Restoring...'
                        : `Restore #${displayedSnapshot.seq}`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 3x3 Pixel Board */}
          <GameBoard
            board={displayedSnapshot.board}
            currentTurn={displayedSnapshot.currentTurn}
            outcome={displayedSnapshot.outcome}
            winningLine={displayedSnapshot.winningLine}
            lastMoveCell={displayedSnapshot.lastMoveCell}
            canInteract={canInteract}
            isPreviewing={isPreviewing}
            onCellClick={handleCellClick}
          />

          {actionError && (
            <p className="text-xs font-medium text-red-700 text-center mt-4" role="alert">
              {actionError}
            </p>
          )}

          {/* Waiting for Friend Invite Bar */}
          {activeMatch.status === 'waiting' && (
            <div className="mt-6 p-4 bg-white border-2 border-slate-900 shadow-[4px_4px_0px_0px_#0F172A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-700">
                  Share this match code with your friend
                </div>
                <div className="font-mono text-2xl font-bold tracking-widest text-slate-900 mt-1 tabular-nums">
                  {activeMatch.gameId}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy('code')}
                  className="font-display px-3.5 py-2 text-[11px] font-bold text-slate-900 bg-[#FAF8F2] border-2 border-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {copiedType === 'code' ? 'Copied!' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('link')}
                  className="font-display px-3.5 py-2 text-[11px] font-bold text-white bg-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_#1D4ED8] hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {copiedType === 'link' ? 'Link Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* Outcome Controls */}
          {!isPreviewing &&
            activeMatch.status === 'active' &&
            reconstructed.outcome !== 'in_progress' && (
              <div className="mt-6 pt-5 border-t-2 border-slate-900 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleRematch}
                    className="font-display px-4 py-2.5 text-xs font-bold text-white bg-slate-900 border-2 border-slate-900 shadow-[3px_3px_0px_0px_#1D4ED8] hover:bg-slate-800 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-50 transition-transform cursor-pointer"
                  >
                    Play Rematch
                  </button>
                  {reconstructed.latestSeq > 0 && (
                    <button
                      type="button"
                      disabled={restoringSeq !== null}
                      onClick={() =>
                        handleRestoreToSeq(Math.max(0, reconstructed.latestSeq - 1))
                      }
                      className="font-display inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-900 bg-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_#0F172A] hover:bg-slate-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-transform cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo Last Move</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleArchiveMatch}
                  className="font-mono text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                >
                  Archive Match
                </button>
              </div>
            )}
        </section>

        {/* Right Column: Turn History Sidebar & Match Switcher */}
        <aside className="lg:col-span-5 bg-[#FAF8F2] border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0F172A] p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#D8D2C0] border-2 border-slate-900 mb-5">
            <button
              type="button"
              onClick={() => setSideTab('timeline')}
              className={`font-display py-2 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sideTab === 'timeline'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-800 hover:bg-white/60'
              }`}
            >
              Turn History
            </button>
            <button
              type="button"
              onClick={() => setSideTab('matches')}
              className={`font-display py-2 text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer tabular-nums ${
                sideTab === 'matches'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-800 hover:bg-white/60'
              }`}
            >
              Matches ({matches.length})
            </button>
          </div>

          {sideTab === 'timeline' ? (
            <EventTimeline
              snapshots={reconstructed.snapshots}
              previewSeq={previewSeq}
              latestSeq={reconstructed.latestSeq}
              currentTurnNumber={displayedSnapshot.activeTurnNumber}
              currentUserUid={user.uid}
              isClosed={activeMatch.status === 'closed'}
              isWaiting={activeMatch.status === 'waiting'}
              restoringSeq={restoringSeq}
              onSelectPreview={setPreviewSeq}
              onRestoreToSeq={handleRestoreToSeq}
            />
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {matches.map((m) => {
                const isCurrent = m.gameId === activeMatch.gameId;
                return (
                  <button
                    key={m.gameId}
                    type="button"
                    onClick={() => {
                      onSelectMatch(m.gameId);
                      setSideTab('timeline');
                    }}
                    className={`w-full flex items-center justify-between gap-3 p-3 border-2 text-left transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-50 border-slate-900 shadow-[3px_3px_0px_0px_#0F172A]'
                        : 'bg-white border-slate-300 hover:border-slate-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                          {m.gameId}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {m.playerXName} vs {m.playerOName}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-600 mt-0.5 tabular-nums">
                        {m.mode === 'ai' ? `AI (${m.aiDifficulty})` : 'Multiplayer'} ·{' '}
                        {m.eventCount} events
                      </div>
                    </div>
                    {isCurrent ? (
                      <span className="font-display text-[11px] font-bold text-blue-700 whitespace-nowrap shrink-0">
                        Active
                      </span>
                    ) : (
                      <span className="font-display text-[11px] font-bold text-slate-700 whitespace-nowrap shrink-0">
                        Switch
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
