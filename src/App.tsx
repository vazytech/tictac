import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  createMatch,
  formatUserError,
  joinMatchByCode,
  normalizeMatchCode,
  subscribeToUserMatches,
  syncUserProfile,
} from './services/gameService';
import type { AiDifficulty, GameMatch, GameMode, Mark } from './types/game';
import { ArenaWorkspace } from './components/ArenaWorkspace';
import { AuthLanding } from './components/AuthLanding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MatchSetupModal } from './components/MatchSetupModal';
import { RulesModal } from './components/RulesModal';
import { TopBar } from './components/TopBar';

function readInitialGameParam(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('game');
  if (!raw) return null;
  const cleaned = normalizeMatchCode(raw);
  return cleaned.length >= 6 ? cleaned : null;
}

function TactixApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [matches, setMatches] = useState<GameMatch[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(() =>
    readInitialGameParam(),
  );

  const [setupModal, setSetupModal] = useState<'create' | 'join' | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [muted, setMuted] = useState(false);

  // Sync Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await syncUserProfile(nextUser);
        } catch {
          // Handled via structured handleFirestoreError
        }
      } else {
        setMatches([]);
        setActiveMatchId(null);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to user's matches once signed in
  useEffect(() => {
    if (!authReady || !user) return;
    const unsub = subscribeToUserMatches(user.uid, (list) => {
      setMatches(list);
    });
    return () => unsub();
  }, [authReady, user]);

  // Auto-join or open ?game=CODE once user signs in
  useEffect(() => {
    if (!authReady || !user || !pendingInviteCode) return;

    const code = pendingInviteCode;
    setPendingInviteCode(null);

    joinMatchByCode(user, code)
      .then((res) => {
        setActiveMatchId(res.gameId);
      })
      .catch((err) => {
        setModalError(formatUserError(err, 'Unable to join match.'));
        setSetupModal('join');
      });
  }, [authReady, user, pendingInviteCode]);

  // Keep URL query param synced with active match for easy refresh/sharing
  useEffect(() => {
    if (!user) return;
    const nextUrl = activeMatchId ? `/?game=${activeMatchId}` : '/';
    if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [activeMatchId, user]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In could not be completed.',
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOutUser();
      setActiveMatchId(null);
      window.history.replaceState(null, '', '/');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateMatch = async (params: {
    mode: GameMode;
    aiDifficulty: AiDifficulty;
    playerSymbol: Mark;
  }) => {
    if (!user) return;
    setModalBusy(true);
    setModalError(null);
    try {
      const gameId = await createMatch({ user, ...params });
      setSetupModal(null);
      setActiveMatchId(gameId);
    } catch (err) {
      setModalError(formatUserError(err, 'Failed to create match.'));
      throw err;
    } finally {
      setModalBusy(false);
    }
  };

  const handleJoinMatch = async (code: string) => {
    if (!user) return;
    setModalBusy(true);
    setModalError(null);
    try {
      const res = await joinMatchByCode(user, code);
      setSetupModal(null);
      setActiveMatchId(res.gameId);
    } catch (err) {
      setModalError(formatUserError(err, 'Could not join match.'));
      throw err;
    } finally {
      setModalBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      <TopBar
        isSignedIn={Boolean(user)}
        userName={user?.displayName ?? null}
        onNavigateArena={() => setActiveMatchId(null)}
        onOpenNewMatch={() => {
          if (!user) {
            handleSignIn();
            return;
          }
          setModalError(null);
          setSetupModal('create');
        }}
        onOpenJoinMatch={() => {
          if (!user) {
            handleSignIn();
            return;
          }
          setModalError(null);
          setSetupModal('join');
        }}
        onOpenRules={() => setShowRules(true)}
        onAuthAction={user ? handleSignOut : handleSignIn}
        authBusy={authBusy}
      />

      {!authReady ? (
        <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-sm text-slate-500">Initializing Tactix...</p>
        </main>
      ) : !user ? (
        <AuthLanding
          pendingInviteCode={pendingInviteCode}
          authBusy={authBusy}
          authError={authError}
          onSignIn={handleSignIn}
        />
      ) : (
        <ArenaWorkspace
          user={user}
          matches={matches}
          activeMatchId={activeMatchId}
          muted={muted}
          onToggleMute={() => setMuted((prev) => !prev)}
          onSelectMatch={setActiveMatchId}
          onOpenNewMatch={() => {
            setModalError(null);
            setSetupModal('create');
          }}
          onOpenJoinMatch={() => {
            setModalError(null);
            setSetupModal('join');
          }}
          onQuickCreateMatch={handleCreateMatch}
          onQuickJoinMatch={handleJoinMatch}
        />
      )}

      {setupModal && user && (
        <MatchSetupModal
          initialTab={setupModal}
          busy={modalBusy}
          error={modalError}
          onClose={() => {
            setSetupModal(null);
            setModalError(null);
          }}
          onCreateMatch={(params) => {
            handleCreateMatch(params).catch(() => {});
          }}
          onJoinMatch={(code) => {
            handleJoinMatch(code).catch(() => {});
          }}
        />
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TactixApp />
    </ErrorBoundary>
  );
}
