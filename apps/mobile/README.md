# @linguacast/mobile

The LinguaCast app for iOS and Android: Expo SDK 57, React Native 0.86, `expo-router`.

## What it does today

Four screens — Home, Scanner, Event, Channel — and four sheets: link entry, Appearance, Audio
and Report. Home is device-local memory of the events this phone has opened; a row opens that
event's channel picker, and no channel is remembered. Event and Channel read the public REST
API of whichever server the link names.

It listens. One Socket.IO connection per event, opened by the event's route layout, supplies
live on-air and mute state to both screens and both sheets; pressing Listen opens a mediasoup
consumer and plays the interpreter. The audio survives a locked screen and a backgrounded app,
recovers by itself across a network change, and is controlled from the phone's own lock-screen
controls. The Audio sheet's volume is this listener's own, independent of the device volume,
and its Output row opens the platform's chooser. Reports reach the interpreter's studio.

The speaker studio is not built: there is no microphone path anywhere in this app.

Nothing in the app claims that anybody is hearing audio unless a consumer is open, and three
test files enforce that rather than review — that rule is not scaffolding.

## Running it

This app needs a **custom dev client** and cannot run in Expo Go: `expo-camera`, `expo-sqlite`,
`react-native-svg`, `react-native-webrtc` and the local audio module under `modules/` are all
native. **Pulling a change that touches any of them means rebuilding the dev client** — Metro
alone will not pick a native module up, and the symptom is a red screen naming a module that
is right there in the tree.

```sh
pnpm install                                # from the repo root
pnpm -F @linguacast/mobile ios              # builds and installs the dev client
pnpm -F @linguacast/mobile android
pnpm -F @linguacast/mobile start            # Metro, once a dev client is installed
```

`ios/` and `android/` are generated and gitignored. `pnpm -F @linguacast/mobile prebuild`
regenerates both from `app.json`; never hand-edit them, and never add an `app.config.ts` —
TypeScript 7.0.2, which every package here pins, breaks the Expo CLI's compilation of it.

### There is no `dev` script, on purpose

The repo root's `dev` is `pnpm -r --parallel dev`, and pnpm skips a package that has no such
script. Without that omission, Metro would start every time someone works on the server or the
web app. Start it explicitly with the command above.

## Checks

`pnpm typecheck`, `pnpm check` and `pnpm test` at the repo root all cover this package. The
root test command runs two runners: Vitest for the server, the web app and the contract, and
`jest-expo` here.

- `jest` is pinned to **29**. `jest-expo@57` is built against that line, and under 30 every
  suite fails inside Expo's winter runtime before a test reaches an assertion.
- The suite is **helper-only** and must never render a component, which is why each screen
  keeps its logic in a pure module beside it under `src/screens/`, and so do the socket, media
  and audio layers (`src/socket/reconnect.ts`, `status.ts`, `src/media/stats-entry.ts`,
  `src/audio/volume.ts`, `now-playing.ts`, `output.ts`).
- Tests import `describe`/`it`/`expect` from `@jest/globals`, and import siblings by relative
  path: Jest does not use Metro's tsconfig-path resolution, so `@/` resolves in the app and not
  in a test.

## `tsconfig.json` carries no comments

Not an oversight. The Expo CLI rewrites that file's `include` array on every `expo start`,
dropping any comment and re-expanding the arrays the formatter had collapsed. The reasoning
that would otherwise live there:

It extends `["../../tsconfig.base.json", "expo/tsconfig.base"]` **in that order**, because a
later entry wins on a shared key. `expo/tsconfig.base` contributes `customConditions`, `jsx`,
`lib` and `allowJs` and raises `target`, and sets none of the repo base's strictness flags — so
`strict`, `verbatimModuleSyntax`, `isolatedModules` and `noUncheckedIndexedAccess` survive.

## Importing the workspace packages

`@linguacast/contract` and `@linguacast/client-core` are both consumed as TypeScript source;
Metro transpiles what it resolves, so neither has a build step. Import the contract's subpaths,
never its root barrel, which pulls in Hono — and note `./schemas` does too. This app uses
`./openapi` (types only), `./patterns`, and `./socket` for the report vocabulary.
`__tests__/contract-resolution.test.ts` guards that seam.

`@linguacast/client-core` holds the decision logic shared with the web app: the socket
lifecycle and its hook, channel status, listen intent, the report helpers, and the media state
machine with its recovery ladder. It imports no platform of any kind, which its own boundary
test enforces. Anything coupled to `react-native-webrtc`, to `mediasoup-client` or to a
platform media API stays here, under `src/media/`, `src/audio/` and `modules/`.

React must stay at one version across this app and `apps/web`. pnpm links a single copy of a
workspace peer dependency, and two pins would give this app a second React the moment it
mounts a hook from the shared package — an invalid-hook-call with no obvious cause.

## The local audio module

`modules/linguacast-audio` is tracked in git and autolinked by prebuild, unlike `ios/` and
`android/`. It owns the audio session, the Android `mediaPlayback` foreground service, the
system media controls and the output route. Editing it needs a dev client rebuild, and on iOS
it links against the same WebRTC framework `react-native-webrtc` does — the session it
configures is libwebrtc's own, not a second one beside it.
