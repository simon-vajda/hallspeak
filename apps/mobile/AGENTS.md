# apps/mobile

Rules local to the Expo listener. Repo-wide rules, the socket protocol, media recovery and versioning live in the root `AGENTS.md`; `README.md` here is the contributor-facing setup guide.

## Platform and build

- Expo SDK 57 + React Native 0.86. Targets a **custom dev client, never Expo Go** (`expo-camera`, `expo-sqlite`, `react-native-svg`, `react-native-webrtc` and the local audio module are native). A native dependency or config change needs a dev client rebuild; Metro alone will not pick it up.
- `ios/` and `android/` are generated, gitignored and never hand-edited; native configuration belongs in `app.json` and config plugins. `modules/hallspeak-audio` is a tracked local Expo module, autolinked by prebuild.
- `app.config.ts` only derives `version` from `package.json` and must stay that thin: TypeScript 7.0.2 breaks the Expo CLI's compilation of anything beyond a spread and one field.
- SDK 57 facts: `edgeToEdgeEnabled` is no longer accepted; `userInterfaceStyle: "automatic"` no-ops without `expo-system-ui`; the `expo-camera` plugin's `cameraPermission` supplies `NSCameraUsageDescription`, without which iOS kills the app on camera use.
- Bundle id and Android package `app.hallspeak.mobile` are immutable once a store has seen them.
- `@config-plugins/react-native-webrtc` declares `RECORD_AUDIO` and `SYSTEM_ALERT_WINDOW`; both are blocked in `app.json`. Its iOS microphone usage string cannot be removed without a config plugin of our own (not written).
- No `dev` script, deliberately: root `pnpm dev` would otherwise start Metro. Use `pnpm -F @hallspeak/mobile start`.
- `tsconfig.json` extends `["../../tsconfig.base.json", "expo/tsconfig.base"]` **in that order** (later wins; the repo base supplies strictness). **No comments in that file** — `expo start` rewrites it.

## Contract and shared code

- Depends on `@hallspeak/contract` and `@hallspeak/client-core` as TypeScript source, never on `@hallspeak/web`. No build step is added to either package.
- `src/api/client.ts` gives each request attempt `REQUEST_TIMEOUT_MS` (8s) to reach response headers; a timeout settles as the client's `unavailable(503)`, which `shouldRetryApiQuery` retries, while a React Query cancellation still rejects as a cancellation. Body reading after the headers has no app-level deadline.
- Import contract subpaths only: type-only `./openapi` for payloads, `./patterns` for regexes, **type-only** `./socket` for the report vocabulary. Never the root barrel or `./schemas` (both pull in Hono). `__tests__/contract-resolution.test.ts` guards this.

## Tests

- `jest-expo`, not Vitest (Vitest breaks on any `react-native` import). `jest` is pinned to **29**: `jest-expo@57` fails every suite under 30.
- `jest.config.js` adds a `.mjs` transform and widens `transformIgnorePatterns` by one name for `lucide-react-native`'s ESM.
- Helper-only: never render a component. Screen logic lives in a pure module beside it (`src/screens/home-list.ts`, `scanner-state.ts`, `event-view.ts`, `channel-copy.ts`, `report-rows.ts`; `src/socket/reconnect.ts`, `status.ts`, `server-check.ts`; `src/media/stats-entry.ts`, `ice-clock.ts`; `src/audio/now-playing.ts`, `system-audio.ts`).
- Import `describe`/`it`/`expect` from `@jest/globals` (a real devDependency) and siblings by **relative path** — Jest does not resolve the `@/` alias.

## Routing

- `expo-router`: a file under `app/` is a route. Event and Channel are addressed by host and PIN (`app/events/[host]/[pin]/[slug].tsx`), not a stored record id, so a scanned code opens Event before anything is remembered. `src/links/route.ts` encodes nothing (a dot in a segment was verified to round-trip); it is the one place to change if a router version reserves the character.
- `app/+native-intent.tsx` unwraps `open.hallspeak.app`'s `url` parameter through `parseListenerLink`; malformed links go Home. Associated domains and verified intent filters need the external host's association files, which are separate work.
- Back controls follow fixed hierarchy: Channel dismisses to its Event URL, Event to Home, via `router.dismissTo`.
- Home's title is **Join**, not Listen: it opens speaker links too. A channel link carrying a non-empty `speaker_code` — entered, scanned or arriving through `+native-intent` — opens the `speaker-link` sheet via `destinationHref` in `src/links/route.ts`, which offers the system browser (`Linking.openURL`, never an in-app browser or WebView) or the listener channel. The app never sends, stores or logs the code. The sheet is addressed by validated host, PIN, slug and code and rebuilds the studio URL itself; it must never accept a URL param (`docs/solutions/conventions/a-registered-url-scheme-makes-every-route-param-untrusted.md`).

## Event connection

- `src/socket/provider.tsx` owns the event's one socket and publishes the socket, media leg, output route and report episode through one context. It is the nested layout `app/events/[host]/[pin]/_layout.tsx`, not a per-screen hook: the stack keeps Event mounted under Channel (two sockets otherwise) and sheet routes cannot take props.
- That layout declares its own `unstable_settings.initialRouteName` (a deep link to a channel must still have Event underneath) and declares every screen in the order a guest meets them, **sheet last**. Expo Router passes declared screens first and the navigator has no initial route of its own, so a sheet declared first becomes the starting route.
- The provider fetches `/api/version` before any event request or socket and applies the policy from `@hallspeak/client-core/server`. The result is a `ServerGate` context; the navigator stays mounted through every verdict and each screen renders the gate's message in its own chrome with a back action. A verdict comes only from an answer actually read: a failed refetch over a compatible server leaves the event connected. Strings live in `src/socket/server-check.ts`.
- Reconnect signals, none of which covers the others: returning to foreground reopens a suspended socket; the native session heartbeat reopens a socket found disconnected; a network change **cycles** the socket. The media ladder reads the same heartbeat (`src/media/ice-clock.ts`) and cycles the connection when a step stalls past `STALLED_STEP_MS` (12s, above Socket.IO's ack deadline; 3s over a transport already `failed`). Signalling is skipped while the socket is known disconnected. See `docs/solutions/integration-issues/drive-mobile-listener-recovery-from-a-native-clock-behind-a-locked-screen.md`.
- A transport failure shows one generic message naming no cause (React Native reports untrusted certificates and unreachable hosts identically); only a 404 reports a missing event.
- `src/version.ts` derives the mobile version from `package.json` for the handshake.

## Media shell (`src/media`)

- A receive-only port of the web media shell; the produce branch is absent, not dead code. Thresholds and step decisions come from the shared media state in `packages/client-core`.
- The mediasoup handler is named (`ReactNative106`, typed against mediasoup-client's union so a rename fails `pnpm typecheck`); detection would read a browser user agent. `registerGlobals()` runs at app entry.
- When the recovery ladder gives up, the Channel screen offers a session restart (there is no page to reload).

## Native audio module (`modules/hallspeak-audio`)

Owns the platform audio session, Android `mediaPlayback` foreground service, system media controls, output route and volume readings, recovery clock and network watch. It exists because no maintained package shows lock-screen controls for audio it doesn't play.

- **iOS session**: this module is the single owner — `expo-audio` is not installed, because libwebrtc's `RTCAudioSession` fights any other category setter. Category stays `playAndRecord`, mode default, `.defaultToSpeaker`, Bluetooth A2DP only, activated explicitly. The recording indicator and microphone usage string are consequences. See `docs/solutions/integration-issues/a-receive-only-webrtc-listener-on-ios-still-needs-play-and-record.md`.
- **Android stream**: remote audio plays on the media stream through a `JavaAudioDeviceModule` with media attributes injected into `MainApplication.onCreate` by `plugins/with-media-stream-audio.js`. Setting the audio manager mode does not do this. See `docs/solutions/integration-issues/play-react-native-webrtc-remote-audio-on-androids-media-stream.md`.
- **Android service**: type `mediaPlayback`, never `microphone`. Activation is idempotent both ways so the 30-second hold can span it (Android refuses to start a foreground service from the background). The session follows the guest's **request**, not the consumer: controls withdraw only when `listening` ends, so drops, reconnects, holds and pauses keep the session and report paused. The controls' `playing` follows the consumer.
- **Audio focus** (Android): a `MediaSession` is not a focus request. Request `AUDIOFOCUS_GAIN` with media attributes via `AudioManagerCompat`, `setWillPauseWhenDucked(true)`, at activation and again on the way to playing. A loss arrives as the same `onRemotePause` as the lock screen; resume from a transient loss, not a permanent one.
- Refused activation retries with capped backoff. `POST_NOTIFICATIONS` is requested before first activation but never depended on.
- Controls offer play and pause only: every seek/skip/scrub command disabled on iOS; unknown duration on Android.
- Output route and media volume are read and emitted as events (Android: `AudioDeviceCallback`, `ContentObserver`; iOS: route notification, `outputVolume`). Android's route is ranked by Android's own precedence because `communicationDevice` doesn't describe the media stream.
- Recovery clock: Android holds `PARTIAL_WAKE_LOCK` and emits `onTick` every 2s; iOS mirrors it with a main-runloop `Timer` while the session is active. `onNetworkChange` fires only on a real default-network change (Android compares network handles, iOS interface types).

## No audio settings

The app states the platform's audio settings and offers no control that would duplicate or fail: no Audio sheet, volume slider, mute or output picker; the Channel screen has no audio readout; only the Report sheet's self-check reads media volume. On Android an app can pick the output device only for the call stream, and the media stream wins; iOS's `AVRoutePickerView` is deliberately unused for parity. Do not reintroduce any of it (including `react-native-webrtc`'s per-track `_setVolume`) without revisiting that fork — reasoning in the Android media-stream doc linked above.

## Visual system

- A token module over plain `StyleSheet`, not NativeWind (Tailwind 3 vs web's Tailwind 4).
- `src/theme/tokens.ts` holds both schemes as **hex** (no `oklch()`/`color-mix()` in React Native). Dark `--destructive-muted` and `--destructive-border` are converted from the web's `oklch()`. Hover overlays and `--primary-hover` are omitted; pressed state belongs to `Pressable`. `primaryMuted` is the selection wash (a chosen row), never `live-muted`.
- `withAlpha(role, alpha)` spells `color-mix(<role> N%, transparent)`; never a second hex.
- `screen` type step is 38px (the web's phone size). Ramp resolves `rem` against 16px and tracking `em` against its own step. Display steps name `SpaceGrotesk_600SemiBold`, loaded with `useFonts` behind the splash (not the `expo-font` plugin, whose paths point into pnpm's store).
- Icons come from `lucide-react-native` per-icon subpaths, never the barrel; `src/components/icons.ts` is the registry and its test pins the set.
- `src/theme/scale.test.ts` fails on a colour literal or `fontSize`/`fontWeight`/`fontFamily` outside `tokens.ts` and `typography.ts`; the scanner (over a live camera feed) is its one named exemption.
- Spacing is **not** scanned. `spacing` holds roles (`gutter`, `overlay`, `panel`, `action`, `touch`, `pill`, `control`); a one-off padding stays a literal. A token earns a place only when the same measurement means the same thing in more than one place.
- `primary` (teal) is what can be pressed; `live` (green) is audio moving.
- Every fixed-size circle states half its own box rather than `radius.full` (Android drops an oversized radius and draws a square).

## Native components

- `@expo/ui` supplies only the switch, slider, picker and the iOS header overflow menu, each behind one local wrapper. The menu is `header-menu.ios.tsx` (SwiftUI `Menu` whose label is the 38px glass disc, SF Symbol items) with `header-menu.tsx` for Android: a React Native popover anchored under the 48px target (16dp tonal `surfaces.high`, lucide icons, ripple rows), because `@expo/ui`'s Compose `DropdownMenu` exposes only a container colour — no shape, no elevation, and icons only as XML vector assets. Both take `shareHref`. Text fields are React Native's own (`@expo/ui`'s draws no Android container). Brand-bearing controls, including Home's full-width actions, are plain React Native.
- Every `Host` passes `matchContents={{ vertical: true }}` and `seedColor` (omitting it opts into Material You, letting wallpaper blur teal vs green).
- Liquid glass is gated on `isGlassEffectAPIAvailable()`, not iOS version; Android never gets it. A `GlassView` ignores flex — give it a measured width. Glass tint is opt-in (tinted clear glass over light ground renders solid). Never set `opacity: 0` on a glass view or its parent; animate `glassEffectStyle` to `'none'`.
- `ScreenGlow` is iOS-only, behind Home and the Channel thumb line. The Channel screen's upper wash belongs to `ListenTarget` itself. Event has no glow.
- Every screen draws its header as content (`ScreenHeader`); the navigator supplies none. iOS: a glass disc with a chevron only. Android: Material's flat 48px target, no elevated bar. Background runs under the header. Its optional `menu` slot replaces the balancing spacer at the same width; Event and Channel put `HeaderMenu` there (`Share event` only once the screen has read its event, plus `Appearance`). Home keeps its own Appearance button.

## Screens

- Scanner: one layout on both platforms (close, left-aligned title, prompt, wide action beside the torch), glass on iOS, Material filled button and squircle on Android. No simulator substitute for the camera path.
- Event picker: separate cards on iOS, one connected list on Android (`connectedListShape` in `src/theme/shape.ts`, shared by sheets). An on-air row takes the `live` wash with a `primary` play disc; an offline row carries a chevron and no play affordance, outlined on iOS and borderless on Android, where the connected list already separates rows by tone.
- Loading: a screen waiting on a read draws its skeleton from `Placeholder`/`PlaceholderLine` (`src/components/placeholder.tsx`), never failure copy. A placeholder pulses opacity and holds its resting frame under Reduce Motion (`placeholderFrame`); `PlaceholderLine` stands on an invisible line of the same type step so the text replacing it lands without moving anything. Skeletons share their loaded view's styles rather than copying numbers (`eventLayout` in `event-skeleton.tsx`, `channelRowStyles` in `channel-row.tsx`). One accessibility line per skeleton announces loading; the blocks are hidden.
- Event: `eventScreenState` resolves bad route, blocked, error, loading, ready in that order; loading covers the server version check as well as the event request, and a failed refetch over a shown event stays ready.
- Channel: an unread channel prints neither online nor offline label; the badge slot is held in every state. Before the first read the badge and name slots draw placeholders and `ListenTarget` stays in place, disabled and busy, with no spinner. The report action mounts only while listening. `ListenTarget` shows a native spinner during the `holding` grace, stays at full opacity, disables taps and reports busy to accessibility.
- No copy tells a guest to pull down: there is no pull-to-refresh.
- Listener rings: on mute, stop expanding then shrink and fade over 280ms; unmuting mid-transition resumes from the current phase; animations are cancelled while idle and on unmount.
- The design's "on air for N minutes" sentence is on the forbidden-claim list: the public payload has no broadcast start time.

## Sheets and storage

- Sheets (`link`, `appearance`, `speaker-link`, `share-event`, `[slug]/report`) are `expo-router` routes with `presentation: 'formSheet'`, not a sheet library. Each owns its title and dismiss control as content (Android caps detents at three and renders no header inside a form sheet). `SheetChrome` puts header and body in **one** scroll container.
- `share-event` shows a QR code (`qr-code.tsx`, drawing `drawQr` from `@hallspeak/client-core/qr` with `react-native-svg`, the logo as the `logo-mark-qr` raster because react-native-svg lacks multiply blending) and a compact Copy link; no PIN (the phone holding it is not where a guest types it), no download and no system share sheet. Like `speaker-link` it is addressed by validated `server`/`eventPin` params and rebuilds `eventListenerUrl` itself — never the channel.
- Appearance opens from the Home header, uses `SheetChoice` rows (iOS checkmark, Android radio), defaults to System, and stores `system`/`light`/`dark` under `hallspeak-appearance` in `expo-sqlite/kv-store`. The theme provider restores it synchronously at boot and syncs React Native's native appearance override (`unspecified` for System). A failed write keeps the session's choice and shows an inline message.
- History lives in `expo-sqlite/kv-store`, not `expo-secure-store` (Keychain API, truncates past ~2 KB); synchronous reads paint pinned rows on the first frame. A row records **no channel**. Availability is checked only when tapped — never a launch sweep, which would be slow and disclose to servers where a person worships. Only the guest removes a row; an unreachable event is marked and kept. Home re-reads on focus and on pull.
- Pinning is a visible star button; Remove is also an accessibility action (gestures aren't reachable under VoiceOver/TalkBack). Removal is not confirmed; a snackbar offers Undo.
