---
title: Drive mobile listener recovery from a native clock behind a locked screen
date: 2026-09-13
category: integration-issues
module: apps/mobile
problem_type: integration_issue
component: media
symptoms:
  - "A listener whose phone changes network while locked hears nothing for a minute or more, and audio returns only when the guest looks at the phone"
  - "No ICE recovery step, Socket.IO reconnection attempt or ack timeout fires while the screen is off"
  - "After a network change the socket still reports connected, so nothing treats the link as lost"
  - "The foreground service keeps the process alive, yet no JavaScript deadline makes progress"
root_cause: async_timing
resolution_type: code_fix
severity: high
related_components:
  - apps/mobile/modules/hallspeak-audio
  - packages/client-core
tags:
  - react-native
  - android
  - ios
  - background
  - timers
  - wake-lock
  - socket-io
  - ice-recovery
  - network-change
---

# Drive mobile listener recovery from a native clock behind a locked screen

## Problem

React Native does not service JavaScript timers while an Android app is not visible. Every deadline the listener's recovery depends on is such a timer, so a link dropped behind a locked screen was never recovered until the guest woke the phone. The project recorded about ninety seconds of a dropped link with nothing running.

## Symptoms

- The guest pockets the phone, walks from Wi-Fi onto cellular, and the audio stops without coming back.
- Nothing is logged during the outage. The ICE ladder's `setTimeout` deadlines, Socket.IO's reconnection backoff and its 10s `ackTimeout` (`packages/client-core/src/socket/client.ts:44`) are all suspended.
- A socket over the network the device just left keeps reporting `connected`. Its ping timeout, the thing that would notice, is another suspended timer.
- Unlocking the phone restarts everything at once.

## What Didn't Work

- **Relying on the foreground service.** A foreground service keeps the process, not the CPU. While audio flows, the audio path keeps the device awake. Once a network change stops the audio, nothing holds the CPU, and that is exactly when recovery has work to do (`ListeningService.kt:86-91`).
- **Reconnecting on return to foreground only.** That covers a process suspended outright, but not a link that drops while the app stays backgrounded. It also reopens only a socket that already knows it is disconnected (`apps/mobile/src/socket/reconnect.ts`, `shouldReconnectOnForeground`).
- **Waiting for Socket.IO to notice.** Socket.IO retries a transport failure it saw. A suspension is one it did not see, and its own retry timer is not running.

## Solution

Move the clock into the local Expo module, where the platform keeps servicing it, and let JavaScript act on its events.

**A native heartbeat.** On Android, `ListeningService` takes a `PARTIAL_WAKE_LOCK` (`ListeningService.kt:92-98`) and posts a main-looper tick every `TICK_MS = 2_000L` (`ListeningService.kt:34-38`, `:197`). The module forwards each tick as `onTick` (`HallspeakAudioModule.kt:74`). The manifest declares `android.permission.WAKE_LOCK`. iOS mirrors this with a main-runloop `Timer` in common modes, started and stopped with the audio session (`HallspeakAudioModule.swift:152-157`, `:168-176`, interval `:288`).

**A network-change event that fires only on a real change.** Android registers `registerDefaultNetworkCallback` (`HallspeakAudioModule.kt:78`) and compares `network.networkHandle` against the last one seen (`:300-310`). iOS runs `NWPathMonitor` and compares the first available interface's type (`HallspeakAudioModule.swift:189-203`). Both callbacks also fire on registration and on ordinary capability or path updates. Emitting on those would cycle a healthy connection.

**JavaScript acts on three signals, none of which covers the others** (`apps/mobile/src/socket/use-app-state-reconnect.ts`):

```ts
AppState.addEventListener('change', (next) => {
  if (shouldReconnectOnForeground({ previous, next, connected: socket.connected })) socket.connect();
});

useSessionTick(() => {
  if (socket && shouldReconnectOnTick({ connected: socket.connected })) socket.connect();
});

useNetworkChange(() => {
  socket?.disconnect();
  socket?.connect();
});
```

A network change **cycles** the socket rather than calling `connect()`. The socket still believes it is connected, and only a deliberate close makes the loss real. `connect` is also what the media layer treats as its full reset.

**The media ladder reads the same heartbeat** (`apps/mobile/src/media/use-media.ts:216-243`). Each tick runs whichever armed deadlines have passed (`dueDeadlines` in `apps/mobile/src/media/ice-clock.ts`). If a signalling step has gone unanswered past its limit (`stalledSteps`), the tick cycles the connection. The limit is `STALLED_STEP_MS = 12_000`, above Socket.IO's 10s ack deadline so a merely slow server never trips it. Over a receive transport already `failed`, it drops to `FAILED_STEP_MS = 3_000` (`use-media.ts:747-750`).

## Why This Works

The root cause is that all recovery timing lived on a clock the runtime stops. A tick from the native side is a clock the operating system does not pause, and the wake lock ensures the CPU is available to service it after the audio path stops holding the device awake. The network-change event goes further: it acts on the cause rather than waiting for a deadline to expire on a connection that will never answer. Per the project's own measurement, that turned roughly twenty seconds of recovery into roughly two. The heartbeat remains as the backstop for a drop no network change explains.

## Prevention

- Treat any JavaScript timer in a mobile listener's recovery path (`setTimeout`, `setInterval`, a library's internal backoff or ack timeout) as stopped behind a locked screen. A deadline that must fire there has to be checked from `useSessionTick`.
- Keep a pure "what is due now" helper beside anything armed with `setTimeout` (`ice-clock.ts` is the model), so the tick path is testable without a peer connection.
- When a native watcher emits an event JavaScript acts on destructively, compare against the last value. Both platforms' network callbacks fire on registration and on non-changes.
- Keep any stalled-step bound above the client's `ackTimeout`, so a server that is only slow still reports its own failure.
- Hold the wake lock only for the life of the listening service, and release it in `onDestroy` (`ListeningService.kt:75-78`).

## Related Issues

- [Recover a Chromium listener whose page cannot see the new network](recover-a-chromium-listener-whose-page-cannot-see-the-new-network.md): the web listener's network-handoff failure. That one is a stale browser network view, not suspended timers.
- Introduced by commit "fix(mobile): recover a dropped link on a clock the platform keeps".
