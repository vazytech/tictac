# Security Specification — Tactix Event-Sourced Tic-Tac-Toe

## 1. Data Invariants

1. **Identity Integrity**: Users can only create or update their own `/users/{userId}` profile where `uid == request.auth.uid`, and must have a verified email (`request.auth.token.email_verified == true`).
2. **PII Isolation**: Zero email addresses, phone numbers, or addresses are stored in any Firestore document (`/users`, `/games`, or `/games/{gameId}/events`).
3. **Creator Binding & Initial State**: When creating `/games/{gameId}`, `creatorUid` must equal `request.auth.uid`, `eventCount` must be `0`, `participantUids` must equal `[request.auth.uid]`, and `createdAt == request.time && updatedAt == request.time`.
4. **Match Join Integrity**: Only an authenticated user NOT already in `participantUids` can join a `waiting` PvP match, and only by filling the `OPEN_SEAT` slot (`playerXUid` or `playerOUid`) with `request.auth.uid`, appending `request.auth.uid` to `participantUids`, and transitioning `status` from `'waiting'` to `'active'`.
5. **Immutable Event Log & Atomicity**: Events under `/games/{gameId}/events/{eventId}` are strictly append-only (`update` and `delete` are forbidden). Every event `evt_{seq}` must be created in an atomic batch with a parent `/games/{gameId}` update incrementing `eventCount` by exactly `1` (`getAfter` + `existsAfter`).
6. **Master Gate & Zero Blanket Reads**: Events can only be read or created by participants listed in the parent match's `participantUids`. `allow list` rules strictly evaluate `resource.data.participantUids` without `get()`/`exists()` calls.
7. **Terminal Lock**: Once a match reaches `status == 'closed'`, no further updates or events are permitted.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Write**: Creating a game while `request.auth.token.email_verified == false` -> `PERMISSION_DENIED`.
2. **Shadow Field Injection (User)**: Writing `{ uid, displayName, photoURL, isAdmin: true, createdAt, updatedAt }` to `/users/{uid}` -> `PERMISSION_DENIED`.
3. **Identity Spoofing (Game Create)**: Creating `/games/ABC123` with `creatorUid: "victim-uid"` -> `PERMISSION_DENIED`.
4. **Non-Zero Initial Event Count**: Creating `/games/ABC123` with `eventCount: 5` -> `PERMISSION_DENIED`.
5. **Client Timestamp Forgery**: Creating `/games/ABC123` with a backdated `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
6. **Path ID Poisoning**: Creating `/games/invalid_lowercase_1500_char_junk...` -> `PERMISSION_DENIED`.
7. **Non-Participant Snooping**: Reading `/games/{activeGameId}` or listing `/games/{activeGameId}/events` as User C -> `PERMISSION_DENIED`.
8. **Blanket List Scraping**: Listing `/games` without constraining to `participantUids` containing `request.auth.uid` -> `PERMISSION_DENIED`.
9. **Orphaned Event Creation**: Creating `/games/{gameId}/events/evt_1` without atomically incrementing parent `eventCount` -> `PERMISSION_DENIED`.
10. **Sequence Skipping / Overwrite**: Creating `evt_3` when parent `eventCount` is `1`, or updating/deleting `evt_1` -> `PERMISSION_DENIED`.
11. **Out-of-Bounds Cell Value**: Creating a `MOVE` event with `cell: 99` or `player: "Z"` -> `PERMISSION_DENIED`.
12. **Closed Match Mutation**: Attempting `MAKE_EVENT` or reopening a match whose `status == 'closed'` -> `PERMISSION_DENIED`.
