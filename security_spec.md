# P-MEDIS Healthcare Intelligence Security Specification

## 1. Data Invariants
1. **Verified Gmail Identity**: Every write operation requires `request.auth != null` and `request.auth.token.email_verified == true`.
2. **PII Isolation**: User profiles (`/users/{userId}`) contain email addresses and are strictly readable only by the owner (`request.auth.uid == userId`) or a verified administrator. No blanket `isSignedIn()` reads exist anywhere.
3. **Self-Role Escalation Prevention**: Users creating `/users/{userId}` can only assign `role == 'officer'` unless they are the verified bootstrapped admin. Users can never modify their `role`, `uid`, `email`, or `createdAt` fields after creation.
4. **Master Gate on Sessions**: Subcollection `/users/{userId}/sessions/{sessionId}` enforces parent existence via `exists(/databases/$(database)/documents/users/$(userId))`, strict ownership (`request.auth.uid == userId`), and `userId == request.auth.uid`.
5. **Query Enforcer on Workforce**: `/workforce/{recordId}` strictly enforces `resource.data.ownerId == request.auth.uid || isAdmin()` on `list` and `get`, preventing cross-tenant scraping even if client queries are bypassed.
6. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` (or `loginAt` / `lastLoginAt`) must equal `request.time` on creation/update, and `createdAt` + `ownerId`/`uid` remain immutable forever.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated User Profile Read**: `GET /users/user123` with `auth: null`.
2. **Cross-User PII Read**: `GET /users/victimUid` signed in as `attackerUid`.
3. **Role Self-Escalation on Create**: `CREATE /users/attackerUid` with `{ role: "admin", ... }`.
4. **Role Escalation on Update**: `UPDATE /users/attackerUid` changing `role` from `"officer"` to `"admin"`.
5. **Unverified Email Write**: `CREATE /users/uid1` with `auth.token.email_verified: false`.
6. **Shadow Ghost Field Injection**: `CREATE /workforce/rec1` with extra unexpected key `isVerifiedByMinistry: true`.
7. **ID Poisoning**: `CREATE /workforce/invalid$id#with!chars` or 500-char document ID.
8. **Forged Owner ID**: `CREATE /workforce/rec1` signed in as `uidA` with `ownerId: "uidB"`.
9. **Client-Forged Timestamp**: `CREATE /workforce/rec1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
10. **Blanket List Scraping**: `LIST /workforce` without `where("ownerId", "==", uid)` filter.
11. **Session Orphan Write**: `CREATE /users/uidA/sessions/s1` when `/users/uidA` does not exist.
12. **Session Owner Hijack**: `UPDATE /users/uidA/sessions/s1` signed in as `uidB`.
