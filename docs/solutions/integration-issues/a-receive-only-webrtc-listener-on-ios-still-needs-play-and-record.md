---
title: A receive-only WebRTC listener on iOS still needs the playAndRecord category
date: 2026-09-13
category: integration-issues
module: apps/mobile
problem_type: integration_issue
component: media
symptoms:
  - "`AUIOClient_StartIO failed (-66637)` in the device log"
  - A remote track that is live and receiving packets but makes no sound
  - Interpreted speech routed to the earpiece with call-style processing
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags:
  - ios
  - avaudiosession
  - react-native-webrtc
  - libwebrtc
  - rtcaudiosession
  - receive-only
  - bluetooth
---

# A receive-only WebRTC listener on iOS still needs the playAndRecord category

## Problem
The mobile listener only receives audio, so `AVAudioSession.Category.playback` looks like the right category. With it, libwebrtc's audio never starts: the track is live and nothing is heard.

## Symptoms
- `AUIOClient_StartIO failed (-66637)` in the device log.
- A consumer whose track is live and receiving, with silence at the speaker.
- With libwebrtc's own defaults instead, speech is processed as a call and comes out of the earpiece.

## What Didn't Work
- **`.playback`.** It seems to fit an app that never records, but it produced the -66637 failure and a silent track. This was measured on a device.
- **Leaving activation to libwebrtc.** Auto-activation when a track arrives has a long history of producing a live track with no sound on a receive-only connection.
- **A second audio library.** libwebrtc's `RTCAudioSession` fights any other library that sets a category. That is why `expo-audio` is not installed in `apps/mobile` at all.

## Solution
One module, `apps/mobile/modules/linguacast-audio`, owns the session. It sets libwebrtc's shared configuration before any peer connection exists, because libwebrtc reads it when it builds its audio unit (`apps/mobile/modules/linguacast-audio/ios/LinguacastAudioModule.swift:42-60`):

```swift
OnCreate {
  let configuration = RTCAudioSessionConfiguration.webRTC()
  configuration.category = AVAudioSession.Category.playAndRecord.rawValue
  configuration.mode = AVAudioSession.Mode.default.rawValue
  configuration.categoryOptions = [.defaultToSpeaker, .allowBluetoothA2DP, .allowAirPlay]
  RTCAudioSessionConfiguration.setWebRTC(configuration)
}
```

It activates the session explicitly, under libwebrtc's configuration lock. Activation is idempotent, so the playback hold can span it (`LinguacastAudioModule.swift:143-161`):

```swift
let session = RTCAudioSession.sharedInstance()
session.lockForConfiguration()
defer { session.unlockForConfiguration() }
try session.setConfiguration(RTCAudioSessionConfiguration.webRTC(), active: true)
```

## Why This Works
libwebrtc plays remote audio through a voice-processing I/O audio unit. That unit cannot start under a playback-only category. So the category has to stay `playAndRecord` even though nothing is ever captured.

The problems come from libwebrtc's other defaults, and those can be changed:

- **Mode.** The default voice-chat mode applies call processing to interpreted speech and routes to the earpiece. `Mode.default` removes both.
- **`.defaultToSpeaker`.** Under `playAndRecord`, output goes to the receiver unless this option is set.
- **`.allowBluetoothA2DP` only, never `.allowBluetooth`.** Permitting HFP lets a headset fall back to the hands-free profile, which is call quality.

## Prevention
- Do not change the category to `.playback` to "match" a receive-only app. The failure is silent apart from one log line.
- Do not install a second library that touches `AVAudioSession` (`expo-audio`, a track player). Route every session change through the local module.
- Treat these two consequences as accepted costs, not bugs:
  - iOS considers the app microphone-capable and shows the recording indicator while a guest listens. It stays on while a channel is paused with the session held, which keeps the lock-screen Play control reachable.
  - The `NSMicrophoneUsageDescription` that `@config-plugins/react-native-webrtc` writes (in the package's `withPermissions` step, falling back to its own default string when `app.json` sets none) is load-bearing. Review it before a store submission instead of trying to strip it.
- Verify audio-session changes on a physical device, where the -66637 failure was measured.

## Related Issues
- `docs/solutions/ui-bugs/a-gesture-gated-audiocontext-deadlocks-a-signal-gated-control.md`: the web counterpart of audio that is technically running but inaudible. Different mechanism.
