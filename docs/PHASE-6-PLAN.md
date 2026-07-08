# Phase 6 — Implementation Plan (v2.0)

> Status: **planning**. Scope carries several `TBD`s in ROADMAP/PRD; this document resolves them and scopes the work. Ek A (path obfuscation / custom cipher) is explicitly **not** implemented (archived in PRD Appendix A).

## Goal

Stop account sharing and harden the mobile client, without relying on the experimental Ek A layer. Detection is best-effort and recorded/audited; false positives must not lock out a legitimate member.

## Work items

### 1. Account-sharing detection

**Signal set (resolves `TBD`):**

- **Device fingerprint.** Mobile computes a stable, privacy-respecting hash from `expo-application` + `expo-device` constants (vendor id / brand / model / os build). Sent to the API on sign-in and on QR-token request; stored on the session record. A single user with N distinct fingerprints within a rolling window is the primary sharing signal.
- **Concurrent-session cap.** Max **2** concurrent sessions per user (phone + one extra). Enforced at BetterAuth sign-in via a custom hook that deletes older sessions beyond the cap; rejected beyond — no hard block, the oldest is rotated. "Staff/admin on a second device" is exempt (role-aware threshold).
- **Location inconsistency.** When two of the user's active sessions POST `/api/me/qr-token` within the same 2-minute window and the reported coordinates are > 1 km apart, the second request is flagged (not denied) and logged.

**Surface:**

- New `sharing_signals` Mongo collection: `{ userId, kind, fingerprint|sessionIdA|sessionIdB, meta, at }`, TTL 30 days.
- Audit entries (`account-share-flagged`) visible in the panel Audit page.
- Optional future: panel "Sharing" page per flagged user. Out of scope for v2.0 — v2.1 if needed.

**Non-goal:** no automatic account lock for sharing in v2.0 (avoid false-positive lockouts). Soft signals only.

### 2. Mobile anti-debugging

- Detect a rooted/jailbroken device and an attached debugger at startup; show a warning and **disable QR issuance** (not login) when detected. Login still works so the member is never fully bricked.
- Libraries to evaluate: `react-native-detector`-style plugins or a minimal native check via `expo-modules-core`. If a ready Expo SDK 57 plugin is unavailable, ship a lightweight JS heuristic (timing-based debugger detection) as a stopgap and mark the feature degraded.
- Config flag `OPENGYM_ANTI_DEBUG=on|off` (default on) so operators can disable for emulator dev.

### 3. Anti-GPS-spoofing

- Reject mock-location providers: `Location.getCurrentPositionAsync` → check `location.mocked` (Android) / documented iOS limitation → if true, return `OUT_OF_RANGE`-style rejection with message "Konumunuz sahte olarak işaretlendi." Do not block login.
- Pair with the existing QR issuance gate; spoofed location simply refuses to mint a QR (consistent with US-5).

### 4. Ek A — evaluation only, not built

- Confirmed archived. No path obfuscation, no custom cipher in this or any planned phase unless a concrete need arises. Kept in PRD for historical context.

## Phasing / order

1. Backend: session-fingerprint capture + concurrent-session cap + `sharing_signals` + audit.
2. Mobile: fingerprint submission, mock-location rejection, anti-debug gate.
3. Panel: expose flagged signals in Audit (no new page in v2.0).
4. E2E: simulate two devices per user, mock-flagged location, anti-debug.

## Definition of Done

- A member using two devices starts hitting the concurrent-session cap (oldest rotated) and a `sharing_signals` record is created; flagged events appear in the panel Audit page.
- A mocked-location device cannot mint a QR; rejection message is shown.
- An anti-debug-positive device can log in but cannot mint a QR.
- Repo-wide lint + typecheck + build green; security review of the new session/fingerprint paths clean.