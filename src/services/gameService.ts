import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  AiDifficulty,
  GameEvent,
  GameMatch,
  GameMode,
  Mark,
} from '../types/game';

const GAME_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GAME_CODE_REGEX = /^[A-Z0-9]{6,12}$/;
const MAX_DISPLAY_NAME = 64;
const MAX_PHOTO_URL = 500;
const MAX_EVENTS_PER_MATCH = 500;

export function formatUserError(err: unknown, fallback = 'An unexpected error occurred.'): string {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      if (parsed.error.includes('Missing or insufficient permissions')) {
        return 'Match not found or you do not have access to this match.';
      }
      return parsed.error;
    }
  } catch {
    // Plain error message
  }
  return err.message || fallback;
}

export function sanitizeDisplayName(name: string | null | undefined): string {
  const cleaned = (name ?? '').trim().slice(0, MAX_DISPLAY_NAME);
  return cleaned.length > 0 ? cleaned : 'Player';
}

export function sanitizePhotoUrl(url: string | null | undefined): string {
  return (url ?? '').trim().slice(0, MAX_PHOTO_URL);
}

export function generateMatchCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += GAME_CODE_CHARS[Math.floor(Math.random() * GAME_CODE_CHARS.length)];
  }
  return code;
}

export function normalizeMatchCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidMatchCode(code: string): boolean {
  return GAME_CODE_REGEX.test(code);
}

export async function syncUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const displayName = sanitizeDisplayName(user.displayName);
  const photoURL = sanitizePhotoUrl(user.photoURL);

  try {
    const existing = await getDoc(userRef);
    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CreateMatchInput {
  user: User;
  mode: GameMode;
  aiDifficulty: AiDifficulty;
  playerSymbol: Mark;
}

export async function createMatch({
  user,
  mode,
  aiDifficulty,
  playerSymbol,
}: CreateMatchInput): Promise<string> {
  const playerName = sanitizeDisplayName(user.displayName);

  for (let attempt = 0; attempt < 5; attempt++) {
    const gameId = generateMatchCode(6);
    const path = `games/${gameId}`;
    const gameRef = doc(db, 'games', gameId);

    try {
      const existing = await getDoc(gameRef);
      if (existing.exists()) {
        continue;
      }
    } catch {
      // Another active match already uses this random code; try another
      continue;
    }

    const isAi = mode === 'ai';
    const opponentUid = isAi ? 'AI_MINIMAX' : 'OPEN_SEAT';
    const opponentName = isAi ? 'Minimax AI' : 'Waiting for Friend';

    const payload = {
      gameId,
      mode,
      aiDifficulty: isAi ? aiDifficulty : 'none',
      creatorUid: user.uid,
      playerXUid: playerSymbol === 'X' ? user.uid : opponentUid,
      playerXName: playerSymbol === 'X' ? playerName : opponentName,
      playerOUid: playerSymbol === 'O' ? user.uid : opponentUid,
      playerOName: playerSymbol === 'O' ? playerName : opponentName,
      participantUids: [user.uid],
      status: isAi ? 'active' : 'waiting',
      eventCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(gameRef, payload);
      return gameId;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  throw new Error('Could not allocate a unique match code. Please try again.');
}

export async function joinMatchByCode(
  user: User,
  rawCode: string,
): Promise<{ status: 'joined' | 'already_in'; gameId: string }> {
  const gameId = normalizeMatchCode(rawCode);
  if (!isValidMatchCode(gameId)) {
    throw new Error('Match codes must be 6–12 letters and numbers.');
  }

  const path = `games/${gameId}`;
  const gameRef = doc(db, 'games', gameId);
  let snap;

  try {
    snap = await getDoc(gameRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (!snap.exists()) {
    throw new Error(`No match found for code ${gameId}.`);
  }

  const match = snap.data() as GameMatch;

  if (match.participantUids.includes(user.uid)) {
    return { status: 'already_in', gameId };
  }

  if (match.mode !== 'pvp' || match.status !== 'waiting') {
    throw new Error('This match is no longer open for joining.');
  }

  const joinerName = sanitizeDisplayName(user.displayName);

  try {
    if (match.playerOUid === 'OPEN_SEAT') {
      await updateDoc(gameRef, {
        playerOUid: user.uid,
        playerOName: joinerName,
        participantUids: [match.playerXUid, user.uid],
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    } else if (match.playerXUid === 'OPEN_SEAT') {
      await updateDoc(gameRef, {
        playerXUid: user.uid,
        playerXName: joinerName,
        participantUids: [match.playerOUid, user.uid],
        status: 'active',
        updatedAt: serverTimestamp(),
      });
    } else {
      throw new Error('This match already has two players.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return { status: 'joined', gameId };
}

export async function appendMoveEvent(params: {
  match: GameMatch;
  user: User;
  player: Mark;
  cell: number;
  isAiMove: boolean;
}): Promise<void> {
  const { match, user, player, cell, isAiMove } = params;

  if (cell < 0 || cell > 8 || !Number.isInteger(cell)) {
    throw new Error('Invalid board cell index.');
  }

  const gameRef = doc(db, 'games', match.gameId);
  const actorName = isAiMove
    ? 'Minimax AI'
    : sanitizeDisplayName(user.displayName);

  try {
    await runTransaction(db, async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists()) {
        throw new Error('Match no longer exists.');
      }
      const latestMatch = gameSnap.data() as GameMatch;
      if (latestMatch.status !== 'active') {
        throw new Error('Match is not active.');
      }
      const nextSeq = latestMatch.eventCount + 1;
      if (nextSeq > MAX_EVENTS_PER_MATCH) {
        throw new Error('Match event limit reached. Please start a new match.');
      }

      const eventId = `evt_${nextSeq}`;
      const eventRef = doc(db, 'games', match.gameId, 'events', eventId);

      tx.set(eventRef, {
        seq: nextSeq,
        type: 'MOVE',
        actorUid: user.uid,
        actorName,
        player,
        cell,
        targetSeq: -1,
        isAiMove,
        participantUids: latestMatch.participantUids,
        createdAt: serverTimestamp(),
      });
      tx.update(gameRef, {
        eventCount: nextSeq,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `games/${match.gameId}/events`);
  }
}

export async function appendRestoreEvent(params: {
  match: GameMatch;
  user: User;
  targetSeq: number;
}): Promise<void> {
  const { match, user, targetSeq } = params;

  if (targetSeq < 0 || !Number.isInteger(targetSeq)) {
    throw new Error('Invalid restore target turn.');
  }

  const gameRef = doc(db, 'games', match.gameId);
  const actorName = sanitizeDisplayName(user.displayName);

  try {
    await runTransaction(db, async (tx) => {
      const gameSnap = await tx.get(gameRef);
      if (!gameSnap.exists()) {
        throw new Error('Match no longer exists.');
      }
      const latestMatch = gameSnap.data() as GameMatch;
      if (latestMatch.status !== 'active') {
        throw new Error('Match is not active.');
      }
      const nextSeq = latestMatch.eventCount + 1;
      if (targetSeq >= nextSeq) {
        throw new Error('Invalid restore target turn.');
      }
      if (nextSeq > MAX_EVENTS_PER_MATCH) {
        throw new Error('Match event limit reached. Please start a new match.');
      }

      const eventId = `evt_${nextSeq}`;
      const eventRef = doc(db, 'games', match.gameId, 'events', eventId);

      tx.set(eventRef, {
        seq: nextSeq,
        type: 'RESTORE',
        actorUid: user.uid,
        actorName,
        player: 'NONE',
        cell: -1,
        targetSeq,
        isAiMove: false,
        participantUids: latestMatch.participantUids,
        createdAt: serverTimestamp(),
      });
      tx.update(gameRef, {
        eventCount: nextSeq,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `games/${match.gameId}/events`);
  }
}

export async function closeMatch(gameId: string): Promise<void> {
  const path = `games/${gameId}`;
  try {
    await updateDoc(doc(db, 'games', gameId), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToMatch(
  gameId: string,
  onData: (match: GameMatch | null) => void,
): Unsubscribe {
  const path = `games/${gameId}`;
  return onSnapshot(
    doc(db, 'games', gameId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData(snapshot.data() as GameMatch);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

export function subscribeToMatchEvents(
  gameId: string,
  uid: string,
  onData: (events: GameEvent[]) => void,
): Unsubscribe {
  const path = `games/${gameId}/events`;
  const q = query(
    collection(db, 'games', gameId, 'events'),
    where('participantUids', 'array-contains', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: GameEvent[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<GameEvent, 'id'>),
      }));
      items.sort((a, b) => a.seq - b.seq);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}

export function subscribeToUserMatches(
  uid: string,
  onData: (matches: GameMatch[]) => void,
): Unsubscribe {
  const path = 'games';
  const q = query(
    collection(db, 'games'),
    where('participantUids', 'array-contains', uid),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const matches = snapshot.docs.map((d) => d.data() as GameMatch);
      matches.sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() ?? 0;
        const bMs = b.updatedAt?.toMillis?.() ?? 0;
        return bMs - aMs;
      });
      onData(matches);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    },
  );
}
