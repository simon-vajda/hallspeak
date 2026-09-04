# @linguacast/mobile

The LinguaCast listener app for iOS and Android. Speaker and admin surfaces stay on the web;
this package is a listener client only.

## Expo Go is not a supported target

The app depends on `expo-camera`, `expo-sqlite` and (later) `react-native-webrtc` — all native
modules — so it can only run in a **custom development build**. Every contributor produces that
build once per platform, then iterates against Metro without rebuilding.

## Producing the dev build

Install the platform toolchain first: Xcode with an iOS Simulator runtime for iOS, and Android
Studio (or the command-line SDK) plus a device or emulator for Android. Then, from this
directory:

```sh
pnpm ios        # builds, installs and launches on the iOS Simulator
pnpm android    # builds, installs and launches on a connected device or emulator
```

Each command runs `expo prebuild` first. **SDK 57 clean-regenerates `ios/` and `android/`**, so
nothing in those directories may be hand-edited and expected to survive — native configuration
belongs in `app.json` and its config plugins. Both directories are gitignored for that reason.

## Day-to-day

```sh
pnpm start      # Metro, in dev-client mode
pnpm typecheck
pnpm test
```

There is deliberately **no `dev` script**. The repo root's `dev` is `pnpm -r --parallel dev`, and
pnpm skips a package that does not define one — so omitting it keeps Metro out of the way of
everyone working on the server and the web app. Start Metro explicitly with `pnpm start`.

## TypeScript

`tsconfig.json` extends `../../tsconfig.base.json` **then** `expo/tsconfig.base`, in that order.
A later entry wins on a shared key, which is the point: `expo/tsconfig.base` contributes
`customConditions`, `jsx`, `lib` and `allowJs` and raises `target`, while setting none of the
repo base's strictness flags — so `strict`, `verbatimModuleSyntax`, `isolatedModules` and
`noUncheckedIndexedAccess` survive untouched. It also sets no option TypeScript 7 removed, so
unlike `apps/web` there is no `baseUrl` to work around.

Do not put comments in `tsconfig.json`: the Expo CLI rewrites its `include` array on every
`expo start` and drops them. This section is where that reasoning lives instead. That rewrite
also re-expands the file's arrays, which Biome then collapses — so after running Metro, expect
`tsconfig.json` to show up as a formatting-only diff and settle again on the next
`pnpm check:fix`.

## Tests

Tests run on `jest-expo`, not the repo's Vitest: Vitest is off Expo's supported path and breaks
as soon as a test imports anything from `react-native`. The workspace therefore runs two test
runners, which is the accepted cost. `pnpm test` at the repo root runs both.

The suite is helper-only — it exercises the pure modules under `src/venues/` and `src/theme/`
and renders no components, the same rule `apps/web` follows.
