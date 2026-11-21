/**
 * Security Rules Specification Verification Suite (Dirty Dozen Payloads)
 * Documents and validates all 12 adversarial payloads against the expected
 * Firestore Rules invariants defined in security_spec.md.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  path: string;
  payload: Record<string, unknown> | null;
  expectedResult: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_CASES: AdversarialCase[] = [
  {
    id: 1,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/games/K7M3P9',
    payload: { gameId: 'K7M3P9', mode: 'ai', eventCount: 0 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() requires request.auth.token.email_verified == true',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on UserProfile',
    operation: 'create',
    path: '/users/user1',
    payload: {
      uid: 'user1',
      displayName: 'Mallory',
      photoURL: '',
      isAdmin: true,
      createdAt: 'REQUEST_TIME',
      updatedAt: 'REQUEST_TIME',
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "isValidUserProfile() checks keys().hasOnly(['uid', 'displayName', 'photoURL', 'createdAt', 'updatedAt'])",
  },
  {
    id: 3,
    name: 'Identity Spoofing on Game Create',
    operation: 'create',
    path: '/games/K7M3P9',
    payload: {
      gameId: 'K7M3P9',
      creatorUid: 'victim_uid',
      participantUids: ['victim_uid'],
    },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidGameMatch() requires data.creatorUid == request.auth.uid',
  },
  {
    id: 4,
    name: 'Non-Zero Initial Event Count',
    operation: 'create',
    path: '/games/K7M3P9',
    payload: { gameId: 'K7M3P9', eventCount: 5 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'games create requires incoming().eventCount == 0',
  },
  {
    id: 5,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/games/K7M3P9',
    payload: { gameId: 'K7M3P9', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'games create requires incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 6,
    name: 'Path ID Poisoning',
    operation: 'create',
    path: '/games/bad_id_lowercase_toolong_123456789',
    payload: { gameId: 'bad_id_lowercase_toolong_123456789' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "isValidGameCode(gameId) enforces ^[A-Z0-9]+$ and size 6..12",
  },
  {
    id: 7,
    name: 'Non-Participant Snooping on Active Match',
    operation: 'get',
    path: '/games/K7M3P9',
    payload: null,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "games get requires status == 'waiting' or request.auth.uid in existing().participantUids",
  },
  {
    id: 8,
    name: 'Blanket List Scraping',
    operation: 'list',
    path: '/games',
    payload: null,
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'games list requires request.auth.uid in resource.data.participantUids',
  },
  {
    id: 9,
    name: 'Orphaned Event Creation',
    operation: 'create',
    path: '/games/K7M3P9/events/evt_1',
    payload: { seq: 1, type: 'MOVE', player: 'X', cell: 4 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'events create enforces getAfter(parent).data.eventCount == incoming().seq',
  },
  {
    id: 10,
    name: 'Sequence Skipping or Event Mutation',
    operation: 'update',
    path: '/games/K7M3P9/events/evt_1',
    payload: { cell: 0 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'events allow update, delete: if false (strictly append-only)',
  },
  {
    id: 11,
    name: 'Out-of-Bounds Cell Value',
    operation: 'create',
    path: '/games/K7M3P9/events/evt_1',
    payload: { seq: 1, type: 'MOVE', player: 'X', cell: 99 },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidGameEvent() requires cell >= 0 && cell <= 8 for MOVE events',
  },
  {
    id: 12,
    name: 'Closed Match Mutation',
    operation: 'update',
    path: '/games/K7M3P9',
    payload: { status: 'active' },
    expectedResult: 'PERMISSION_DENIED',
    enforcedByRule: "games update blocks all actions when existing().status == 'closed'",
  },
];
