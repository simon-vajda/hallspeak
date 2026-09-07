# @linguacast/mobile

The LinguaCast app for iOS and Android: Expo SDK 57, React Native 0.86, `expo-router`.

## What it does today

Four screens — Home, Scanner, Event, Channel — and four sheets: link entry, Appearance, Audio
and Report. Home is device-local memory of the events this phone has opened; a row opens that
event's channel picker, and no channel is remembered. Event and Channel read the public REST
API of whichever server the link names.

The socket and media layers are not built yet, so a channel's on-air state is for now a reading
taken when the fetch answered, and the Audio and Report sheets are drawn ahead of the state
they will read. Nothing in the app claims that anybody is hearing audio, and three test files
enforce that rather than review — that rule outlives this stage and is not scaffolding.

## Running it

This app needs a **custom dev client** and cannot run in Expo Go: `expo-camera`, `expo-sqlite`
and `react-native-svg` are native modules.

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
  keeps its logic in a pure module beside it under `src/screens/`.
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

## Importing the contract

`@linguacast/contract` is consumed as TypeScript source; Metro transpiles what it resolves, so
no build step is added to that package. Import its subpaths, never the root barrel, which pulls
in Hono — and note `./schemas` does too. This app uses `./openapi` (types only), `./patterns`,
and a **type-only** import of `./socket`. `__tests__/contract-resolution.test.ts` guards it.
