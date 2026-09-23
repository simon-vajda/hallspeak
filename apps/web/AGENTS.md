# apps/web

Rules local to the web app. Repo-wide rules, the socket protocol, media recovery and versioning live in the root `AGENTS.md`.

## Structure

- Vite 8 + React 19 SPA, TanStack Router with file-based routing: a file under `src/routes/` is a route. Nest routes as directories (`routes/admin/events/$id.tsx`); a directory's layout is its `route.tsx`. `routeTree.gen.ts` is generated, committed and excluded from Biome.
- `tsconfig.json` must not declare `baseUrl`.
- `src/api` is web-only (same-origin base path, credentials); mobile shares its shape, not the module.
- `src/lib/socket.ts` exports `connectSocket(auth)`, not a singleton: the handshake carries the event PIN, so one socket per page.
- Components are filed by flow: `components/guest`, `speaker`, `admin`, `auth`. Anything used by more than one flow lives at `components/` root (`logo-lockup.tsx`, `PlayTarget`, `LevelMeter`, `LiveDot`, `LiveBadge`, `AppHeader`, `ConnectionLine`, `ConfirmDialog`, `MICRO_LABEL`, `Pin`, `ResponsiveSurface`). The second flow needing a component moves it to root rather than importing across. None of it is a `packages/client-core` candidate.
- One non-trivial product component per `.tsx` file (screens, stateful forms, mutation owners, reusable views), even with one importer. Small private render helpers and small compound families may stay together. No feature barrel files.
- Tests are pure-helper only: `vitest.config.ts` sets the `@` alias and nothing else, no jsdom, not reusing `vite.config.ts`. A test that needs rendering is a reason to reconsider the test.

## shadcn (`src/components/ui`)

- Add or update with `pnpm dlx shadcn@latest add <name>` from `apps/web`, then `pnpm check:fix`. When `add` offers to overwrite `button.tsx` as a dependency (e.g. `sheet`), decline.
- `biome.json` disables six lint rules for this directory only; do not hand-fix generated files.
- **A default every call site overrides is a bug** — push the product value into the primitive. See `docs/solutions/conventions/customising-generated-shadcn-components.md` and `docs/solutions/conventions/a-primitive-default-every-call-site-overrides.md`.
- Every customisation must be listed here, because a later `add` silently drops it:
  - `button.tsx`: `pill` size (`h-12 rounded-full px-6 text-base font-semibold`); action sizes `action`, `action-sm`, `icon-action`; `destructive-solid` variant (confirming half of a destructive dialog; `destructive` is the row-action tint). Shadcn's own `text-[0.8rem]` on `sm` stays.
  - `switch.tsx`: checks to `foreground`; `tone` prop opts into `primary`; `lg` size (46×27, 21px thumb, padding and checked offset written out).
  - `input.tsx`: `shape` variant defaulting to `pill`.
  - `dialog.tsx`: `DialogContent` defaults to `rounded-lg p-panel`, no gap; `DialogTitle` to `text-title`; `DialogDescription` to `text-note`.
  - `badge.tsx`: `size` variant holding the chip geometry.
  - `select.tsx` trigger and `slider.tsx` thumb: `cursor-pointer`.
  - `sonner.tsx`: `useTheme` from `@/components/theme-provider`, not `next-themes`.
  - `dropdown-menu.tsx`: panel `p-2` around `rounded-sm` rows (12px + 8px padding nests inside the 20px `rounded-lg` panel), rows `min-h-touch lg:min-h-action px-3 gap-2.5`, separator `-mx-2 my-2`; imports `cn` from `@/lib/utils`; the CLI generated `from "cn"` and added an unrelated `cn` npm package — revert that dependency if it reappears.
  - `chart.tsx`: imports `cn` from `@/lib/utils` (the CLI generated `from "cn"` and added the unrelated `cn` npm package again — revert that dependency if it reappears). It brings `recharts`; the generic `--chart-1..5` palette is unused, a `ChartConfig` names a role token instead. `biome.json` turns `noDangerouslySetInnerHtml` off for this directory because `ChartStyle` emits its colour variables as a `<style>` tag.
  - `skeleton.tsx`: `motion-reduce:animate-none`, so every skeleton holds still under reduced motion; imports `cn` from `@/lib/utils` (the CLI generated `from "cn"` and added the unrelated `cn` npm package — revert that dependency if it reappears).
  - `card.tsx` and `label.tsx` were deleted (no importers).
  - The `rounded-[min(var(--radius-md),Npx)]` clamps on button `xs`/`sm` and the small select trigger are shadcn's own; leave them.
- Prefer call-site classes for one-off styling.

## Design scale

Procedure for a new value: `docs/solutions/conventions/design-values-onto-the-scale.md`.

- Off-scale values go on the Tailwind scale, not into arbitrary utilities (26px is `6.5`, 18px `4.5`, 1120px `280`).
- Named spacing in `index.css`: `--spacing-gutter` (26px screen gutter, `px-10` from `lg`), `--spacing-shell` (content cap), `--spacing-header` (62px sticky header incl. border), `--spacing-panel` (22px), `--spacing-action-x` (17px), `--spacing-action` (38px), `--spacing-touch` (44px).
- Type ramp, fifteen `--text-*` entries each carrying weight, line-height and any fixed tracking: `screen`/`screen-lg`, `hero`/`hero-lg`, `stat`/`stat-lg`, `pin`/`pin-lg`, `title`, `subtitle`, `section`, `body-lg`, `label`, `meta`, `note`. Body is `text-sm`; 16/18/20px are `text-base`/`lg`/`xl`. No `text-[…]` anywhere in `src` except shadcn's `text-[0.8rem]`. A new size joins the ramp or reuses a step; near-duplicates collapse.
- Radius: `rounded-lg` (20px) panel, `rounded-md` (16px) PIN slot, `rounded-xl` (28px) sheet. `level-meter.tsx`'s `rounded-[1px]` is the one literal.
- Animations `--animate-pulse-live`, `--animate-ring`, `--animate-ring-delayed` hold a resting frame under `prefers-reduced-motion`. Where canvas and handoff prose disagree on an animation, the canvas wins.
- Arbitrary values remain right for one-off grid templates.

## Colour

- Colours are `--color-*` tokens referenced by role, never a hex at a call site and never a role borrowed to mean something else.
- `primary` is what can be pressed; `live` is audio moving. `--live-on-muted` is live colour as type on `live-muted` or `secondary`, never on a `live` fill.
- `warn` has four tokens (`--warn`, `--warn-on-muted`, `--warn-muted`, `--warn-border`): a row wash and a figure, never a solid fill or dot. No `--warn-foreground`.
- Deviations from the handoff: dark `--destructive-muted`/`--destructive-border` are rebuilt on the dark destructive hue; dark `--accent` is lifted to the `border` step.
- **Hover** moves toward `foreground` by a fixed mix, never by lowering opacity: `hover:overlay` on a control with a resting fill, `hover:overlay-strong` without one (both paint a background image), `hover:bg-primary-hover` on a solid primary fill. Opacity hovers (`hover:bg-muted/50`) are the bug this replaces — in dark mode `muted`, `secondary`, `card` and `popover` are one value.
- **Focus**: filled controls take a ring; bare text links and full-row link targets take a 2px outline; offset 2 everywhere.
- **Touch targets**: a control in a cluster of siblings is 44px below `lg`, 38px from `lg` — the action sizes do this. A control alone in its row does not bump; named exceptions are the admin nav links and the guest back button.

## Shared chrome

- Every guest and studio screen shares one `AppHeader`: sticky, 62px, brand lockup and theme toggle over a bottom border — no event name, no PIN. The channel listener page replaces the lockup with a back link (chevron plus event name truncated at 230px, 320px from `lg`). No channel strip or phone PIN line.
- Phone user agents alone see the app notice: a first-visit dialog, then an `About the app` chip; either answer is stored under `hallspeak-app-notice`, and the chip slot stays reserved while the dialog is open. `Listen in the app` links to `https://open.hallspeak.app/?url=` with the absolute channel URL encoded once.
- `lib/phone-browser.ts`: `isPhoneBrowser` (excludes tablets; app notice) and `isHandheldBrowser` (includes iPadOS via touch count; wake-lock chip).
- Public route components call `useDocumentTitle` with the contract's formatters; leaving resets the tab to `Hallspeak`.

## Guest listener

- Guest screens have no audio settings or output/volume readout; playback uses system output and the element's default volume.
- The listener target is disabled until a producer exists. It uses `PlayTarget`'s 180px icon-only presentation (54px glyph, accessible label); speakers keep visible labels.
- An unexpected close during active playback keeps only a 30-second deadline-backed hold; deliberate end, expiry or link loss clears it at once.
- `ConnectionLine` renders the one status for combined Socket.IO and mediasoup health (`LinkState`). Socket lifecycle: a retryable disconnect shows `Connection lost`, `reconnect_attempt` advances to `Reconnecting…`, `connect` clears. A `connect_error` is retryable only while `socket.active`; a handshake refusal and `io server disconnect` are terminal. No public connection toast.
- `LinkState` kind `idle` (connected socket, `mediaWanted` false) renders empty; `isLinkUp` counts it as up, and broadcast copy gates on `isLinkUp`, not on the line's vocabulary. The line reserves `min-h-12` in every state.
- The nine-bar waveform is real, graded from WebRTC stats by `lib/media/stats.ts`.
- `PlayTargetRing` mute settle: pauses each CSS pulse at its phase and overlays a shrink/fade; unmuting reverses it; speaker rings keep their behaviour.

## Browser audio (`src/lib/audio`)

Web-only; not a `packages/client-core` candidate.

- `level.ts` RMS, decibel mapping, thresholds, meter motion; `devices.ts` microphone list shaping; `preferences.ts` preference type, constraint and gain mapping, defaults, tolerant parse/serialize; `media-session.ts` pure Media Session mapping; `use-audio-preferences.ts` storage; `use-listener-media-session.ts` lock-screen metadata, Play/Pause and real playback state; `use-mic-capture.ts` devices, streams, one `AudioContext`/`AnalyserNode` per stream.
- Microphone preferences are one unversioned `hallspeak-audio-preferences` object, parsed field by field against `DEFAULT_AUDIO_PREFERENCES`. Stored values are mount-time defaults, never adopted live; writes merge field by field. Echo cancellation defaults to and emits explicit `false`. Never restore gain below `MIN_RESTORED_GAIN`. Enabling browser auto gain forces the app `GainNode` to unity without discarding the stored gain.
- Open a stream before enumerating (labels are empty before permission); collapse the `default`/`communications` aliases. Release capture only through the path that stops tracks and closes the context.
- Meter values and thresholds are positions on the `METER_FLOOR_DB`-to-full-scale decibel scale. Use `getFloatTimeDomainData`, never the byte API. Fill uses a timestamp-driven one-pole filter (`ATTACK_MS` 20, `RELEASE_MS` 280); `levelStatus` and `data-peaking` use a decaying peak-hold of raw RMS (`HOLD_DECAY_MS`). `speaker-studio.tsx`'s `SIGNAL_POLL_MS` latch stays raw so smoothing cannot delay Go live. See `docs/solutions/ui-bugs/a-gesture-gated-audiocontext-deadlocks-a-signal-gated-control.md`.
- Media Session is best effort. On Android the listener loops an unmuted silent WAV carrier (`media-session-carrier.ts`, `use-media-session-carrier.ts`) only while listening; never mute it or zero its volume; position duration stays `Infinity`; an unrequested pause is the interruption signal. See `docs/solutions/integration-issues/loop-an-unmuted-silent-file-so-android-grants-a-webrtc-listener-media-focus.md`.

## Speaker studio

- Chrome's permission prompt is invisible to an agent driving the devtools MCP; ask the human to grant it first (`docs/solutions/workflow-issues/browser-permission-prompts-stall-the-agent-silently.md`).
- Both studio screens share `AppHeader` and `StudioTitle` (centred badge, event name in muted body type, channel `h1`).
- On air from `lg` is two columns: a stage (title, mute target, connection line, End broadcast, listener link), sticky only on windows at least 45rem tall; and one panel list in DOM order (screen-awake chip, listener reports, stats, input level, audio settings, listener history). A new panel is one appended line — no `order-*`, no per-breakpoint grid. Below `lg` End broadcast and the link sit at the page foot, rendered twice with one copy hidden per breakpoint (never CSS-reordered, which would break tab order).
- `ListenerReports` mounts only while it has reports, a recent resolution, or a tally unknown for two seconds. Its announcements, pre-flight's colleague alert and checking note use `sr-only` live regions that stay mounted.
- `ListenerHistoryPanel` draws the last hour as a step line, withholding the chart — never a line at zero — until a snapshot arrives and again once the socket drops, at one height in every state. Its `recharts` figure is a `lazy` import: the studio and every guest channel page are one route, so a static import would ship the charting library to every listener.
- Pre-flight shows no listener count. `OnAirStats` renders its Listeners tile ungated. `InputLevelPanel` carries no note.
- Handover UI: `speaker/handover-prompt.tsx` and `handover-countdown.tsx` on `speaker/handover-alert.tsx`; every string in `lib/handover-copy.ts` (tested against the audience-claim rule). The prompt is a non-modal row spanning both columns, offering `Hand over` only; the studio keeps transmitting until the swap completes. `studioBadge` reports this studio only, so pre-flight's badge always reads `Off air`; a colleague holding the channel is the warn-toned alert above the title. Pre-flight's `unknown` action raises no alert and is withheld by a disabled `Checking…` action. A completed handover returns to pre-flight via `use-media`'s `abandonProducer`, which sends **no** `media:close-producer`. `SpeakerDisplaced` is only for an organiser ending the session.
- Screen wake lock is held for the life of `SpeakerOnAir` via `lib/use-screen-wake-lock.ts`, best effort, re-requested on `visibilitychange` to visible; it runs on every platform. `ScreenAwakeNotice` shows only on handhelds; its three labels in `lib/screen-awake-copy.ts` are distinct sentences (granted: `Keeping the screen awake`; unsupported/refused: `Screen may dim`; pending: the instruction). The dialog always states the microphone warning; nothing is stored.
- Speaker reconnect preserves the effective mute state (below and root media recovery). The mic target stays live during an outage; a failed mute control resolves to **muted** (`rollbackMutedAfterFailure`); a mute during the outage rewrites the pending `lastEnd`; the studio prefers `localMuted` over the server snapshot whenever `isLinkUp` is false.

## Auth screens

- Setup wizard (`routes/setup.tsx`, two steps) and sign-in (`routes/login.tsx`) share `components/auth/auth-card.tsx`, `password-field.tsx`, `password-checklist.tsx`; `lib/password-rules.ts` is the pure half. The admin header's account menu (`components/admin/account-menu.tsx`, labelled with the username from the session entry) holds `Change password` (a dialog), the light/dark switch and sign-out; no account settings screen. Sign-in and setup responses carry `username` because they seed the session entry.
- State comes from `GET /auth/session` (`lib/auth-queries.ts`), read by `beforeLoad` on `/`, `/admin`, `/setup`, `/login`. A 401 from any admin call invalidates that entry and then the router; `/auth/*` is excluded.
- After setup and sign-in, **seed** the entry from the response rather than invalidating: `ensureQueryData` returns the stale signed-out value during a refetch.
- `?redirect=` is accepted back only as an internal router path.

## Admin

- Three axes, one element each: broadcast is the channel row badge (the one admin element on `live` tokens), audience the `N listening` line (only while on air), availability the enable switch. No `Enabled` chip. Events-list channel chips stay on the enabled wash.
- Live state comes from `GET /admin/live`, polled every 5s — admin has no PIN, so no socket. `AdminLiveEvent` is its own schema and cache entry, kept out of `AdminEventDetail` so polls don't fight optimistic patches in `admin-queries.ts`.
- A failed or pending poll withholds: `useAdminLive` carries `known: false`, screens print an em dash with visually-hidden `Status unknown`. Screens still load with media down.
- Live-aware warnings (`lib/admin-live-warning.ts`): the four destructive dialogs add a line only when the target is on air; enable switches confirm only on the way off; a withheld poll warns about nothing.
- The events table is CSS-grid rows, not `<table>`. Creating an event lands on its detail page.
