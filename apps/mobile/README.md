# @hallspeak/mobile

The Hallspeak app for iOS and Android: Expo SDK 57, React Native 0.86, `expo-router`.

## What it does today

Four screens — Home, Scanner, Event, Channel — and three sheets: link entry, Appearance and
Report. Home is device-local memory of the events this phone has opened; a row opens that
event's channel picker, and no channel is remembered. Event and Channel read the public REST
API of whichever server the link names.

It listens. One Socket.IO connection per event, opened by the event's route layout, supplies
live on-air and mute state to both screens and both sheets; pressing Listen opens a mediasoup
consumer and plays the interpreter. The audio survives a locked screen and a backgrounded app,
recovers by itself across a network change, and is controlled from the phone's own lock-screen
controls. Audio settings are the phone's own: the Channel screen states which output is
carrying the audio and how loud the device is, and offers no control of its own, because
Android lets an app choose the output only for call-stream audio and this is on the media
stream. Reports reach the interpreter's studio.

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
pnpm -F @hallspeak/mobile ios              # builds and installs the dev client
pnpm -F @hallspeak/mobile android
pnpm -F @hallspeak/mobile start            # Metro, once a dev client is installed
```

`ios/` and `android/` are generated and gitignored. `pnpm -F @hallspeak/mobile prebuild`
regenerates both from `app.json`; never hand-edit them. `app.config.ts` only derives `version`
from `package.json` and must stay that thin: TypeScript 7.0.2, which every package here pins,
breaks the Expo CLI's compilation of anything more.

### There is no `dev` script, on purpose

The repo root's `dev` is `pnpm -r --parallel dev`, and pnpm skips a package that has no such
script. Without that omission, Metro would start every time someone works on the server or the
web app. Start it explicitly with the command above.

## Store builds

Store builds run on EAS. `eas.json` defines three build profiles — `development` (a dev
client), `preview` (an internally distributed release build) and `production` (store
signed) — and one `production` submit profile that sends iOS to TestFlight and Android to
Play's closed testing track. EAS assigns iOS build numbers and Android version codes and
raises them on every production build; the version testers see is `package.json`'s. An
EAS-made build shows the same `vX.Y.Z · <commit>` label as a local dev build.

### What a mobile release does

Publishing a `Mobile vX.Y.Z` draft under Releases runs the `Mobile release` workflow. It
checks out the tag, builds iOS and Android on EAS, and submits both. The run waits for the
builds and submissions and fails if either does. Each release spends one iOS and one Android
build of the free plan's monthly allowance (15 each), and so does every rerun.

To rebuild a release without publishing a new one, run `Mobile release` from the Actions tab
with the published tag. Tags up to `mobile-v0.7.0` predate the EAS configuration and cannot
be built.

The workflow stops at the testing tracks. Releasing to the App Store or Play production is a
manual step in each store console.

### One-time setup

Do these in order, from `apps/mobile` on the Mac. Each step needs the ones above it.

1. **Link the EAS project.** `eas login`, then `eas init`. It cannot write into
   `app.config.ts`, so copy the `owner` it prints into `app.json`'s `expo.owner` and the
   project id into `expo.extra.eas.projectId`, and commit both.
2. **Create signing credentials with the first builds.** Run
   `eas build --platform ios --profile production` and
   `eas build --platform android --profile production` interactively. Sign in to Apple when
   asked and let EAS generate the distribution certificate, the provisioning profile and the
   Android upload keystore. CI can never create these: it runs with `--freeze-credentials`.
3. **Back up the Android upload keystore.** `eas credentials -p android`, choose the
   production profile, then download the keystore. Put the `.jks` file and its keystore
   password, key alias and key password in the password manager, then delete the local copy.
   Losing it costs a multi-day upload-key reset with Google.
4. **Set up App Store Connect submission.** In App Store Connect, under Users and Access →
   Integrations, create an App Store Connect API key with the App Manager role. Add it with
   `eas credentials -p ios` → production → App Store Connect API key, for EAS Submit. Put the
   app's numeric Apple ID (App Store Connect → the app → App Information) into `eas.json` as
   `submit.production.ios.ascAppId` and commit it. Create a TestFlight internal testing group,
   then submit the build from step 2 with
   `eas submit --platform ios --profile production --latest`.
5. **Set up Play submission.** Create the app in Play Console with package
   `app.hallspeak.mobile`. Create a Google Cloud service account, enable the Google Play
   Android Developer API for its project, download a JSON key, and invite the account's email
   under Play Console → Users and permissions with release permissions for this app. Save
   the key as `google-service-account.json` here (gitignored) or outside the repository,
   upload it with `eas credentials -p android` → Google Service Account, and delete the local
   copy once EAS shows it.
6. **Submit the first Android build by hand.** Run
   `eas submit --platform android --profile production --latest`. If the API rejects a
   brand-new app, download the `.aab` from the build's page on expo.dev and upload it in Play
   Console under Testing → Closed testing instead. Add the testers' Google Group to the closed
   track.
7. **Give GitHub the Expo token.** Create a personal access token on expo.dev under Account
   settings → Access tokens and add it as the `EXPO_TOKEN` repository secret. It can start
   builds and read project credentials, so revoke and replace it on any suspicion.

GitHub holds nothing else: signing credentials and store keys live only in EAS.

### Building and submitting by hand

A local build spends no cloud build, so it is the fallback when the allowance is used up or
EAS's queue is slow. It still needs `eas login`: EAS supplies the credentials and the next
build number.

```sh
git switch --detach mobile-v0.8.0            # the published tag, from a clean tree
cd apps/mobile
eas build --platform ios --profile production --local --output ~/hallspeak-0.8.0.ipa
eas submit --platform ios --profile production --path ~/hallspeak-0.8.0.ipa
eas build --platform android --profile production --local --output ~/hallspeak-0.8.0.aab
eas submit --platform android --profile production --path ~/hallspeak-0.8.0.aab
```

iOS needs Xcode, CocoaPods and fastlane; Android needs the Android SDK and Java 17. A local
build uses the Mac's own Node and pnpm and ignores the versions `eas.json` pins, so match
`.nvmrc` and the root `packageManager` first.

### Running the tracks

- **Play drafts.** While the Play app is itself a draft, Play accepts only draft releases, so
  each submission lands as a draft on the closed track. Roll it out to testers in Play
  Console under Testing → Closed testing. Once the store listing is complete and the app has
  left draft state, change `releaseStatus` in `eas.json` from `draft` to `completed`.
- **A timed-out run.** The job gives up after 330 minutes, but EAS keeps building. Check the
  builds and submissions on expo.dev before rerunning: a rerun spends two more builds.
- **Play production.** A personal Play account reaches production only after 12 testers
  have been opted in to a closed test for 14 days.

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

`@hallspeak/contract` and `@hallspeak/client-core` are both consumed as TypeScript source;
Metro transpiles what it resolves, so neither has a build step. Import the contract's subpaths,
never its root barrel, which pulls in Hono — and note `./schemas` does too. This app uses
`./openapi` (types only), `./patterns`, and `./socket` for the report vocabulary.
`__tests__/contract-resolution.test.ts` guards that seam.

`@hallspeak/client-core` holds the decision logic shared with the web app: the socket
lifecycle and its hook, channel status, listen intent, the report helpers, and the media state
machine with its recovery ladder. It imports no platform of any kind, which its own boundary
test enforces. Anything coupled to `react-native-webrtc`, to `mediasoup-client` or to a
platform media API stays here, under `src/media/`, `src/audio/` and `modules/`.

React must stay at one version across this app and `apps/web`. pnpm links a single copy of a
workspace peer dependency, and two pins would give this app a second React the moment it
mounts a hook from the shared package — an invalid-hook-call with no obvious cause.

## The local audio module

`modules/hallspeak-audio` is tracked in git and autolinked by prebuild, unlike `ios/` and
`android/`. It owns the audio session, the Android `mediaPlayback` foreground service, the
system media controls and the output route. Editing it needs a dev client rebuild, and on iOS
it links against the same WebRTC framework `react-native-webrtc` does — the session it
configures is libwebrtc's own, not a second one beside it.
