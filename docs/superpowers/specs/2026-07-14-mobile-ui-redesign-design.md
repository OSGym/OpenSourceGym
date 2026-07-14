# OpenGym Mobile UI Redesign

## Summary

OpenGym's mobile app keeps its existing near-black, monochrome identity while
moving to a calmer, native-first product interface. The redesign removes
placeholder fitness content and focuses the member experience on real product
capabilities: occupancy, subscription status, turnstile scanning, profile
management, language selection, and account controls.

The authenticated app uses three working destinations: Home, Scan QR, and
Profile. Authentication remains a small typed state machine and the signed-in
shell uses the same approach; this redesign does not introduce a navigation
framework or change server APIs.

## Information Architecture

- Authentication screens share a safe-area-aware, keyboard-safe `AuthShell`
  with a restrained monochrome equipment image in the upper region.
- Home shows the member greeting, live gym occupancy, subscription status, and
  one clear route to QR scanning. Mock streak, body-weight, gym-hours, and class
  reminder content is removed.
- Scan QR owns camera permission, scanning, validation, success, and denial
  states. Every failure includes a concrete recovery path.
- Profile owns profile/photo data, language selection, sign-out, and account
  deletion. Destructive actions are visually separated from routine settings.
- A labelled three-item tab bar exposes only working destinations and preserves
  each screen's state until sign-out or session loss.

## Visual and Interaction System

- Preserve the committed palette: `#060607` background, dark neutral surfaces,
  off-white primary text, and semantic green/red status colors.
- Use system fonts with fixed product roles: 28 pt screen title, 20–22 pt section
  title, 16–17 pt body, 14–15 pt supporting copy, and 13 pt short labels.
- Cards use 14–16 pt radii; inputs use 12–14 pt radii; pills are reserved for
  badges. A surface never combines a wide decorative shadow with a border.
- All controls provide pressed, focused, disabled, loading, and error states.
  Android's 48 dp minimum touch target is the cross-platform floor.
- Motion lasts 150–220 ms and communicates only press, tab, or result state.
  Reduced-motion users receive a short crossfade or an immediate state change.
- QR success/error may emit one best-effort haptic after the camera stops;
  visual feedback remains authoritative.

## Data and Interfaces

- Existing API routes and `@opengym/shared` types remain unchanged.
- Home fetches subscription and occupancy data. Profile fetches profile and
  deletion-request data and owns photo upload/removal mutations.
- Local authenticated navigation uses `AppTab = "home" | "scan" | "profile"`.
- Shared UI exposes semantic button variants and field helper/error states.
- All new user-facing strings are added to Turkish and English resources.

## Quality Bar

- Authentication remains usable with the keyboard open on small phones.
- Safe areas, bottom insets, landscape, large system text, screen-reader order,
  and reduced motion are explicitly supported.
- Loading retains spatial stability; refresh keeps prior data visible; network
  failures provide retry actions.
- Camera and location permission failures, compromised-device blocking, and all
  gate denial codes remain recoverable and understandable.
- Mobile lint, typecheck, tests, and an Android dev-client build must pass.

## Non-goals

This work adds no payments, classes, training or diet features, body tracking,
new backend endpoints, experimental obfuscation, light theme, or multi-branch
behavior.
