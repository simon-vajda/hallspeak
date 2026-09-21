---
title: Play react-native-webrtc remote audio on Android's media stream
date: 2026-09-13
category: integration-issues
module: apps/mobile
problem_type: integration_issue
component: media
symptoms:
  - "A receive-only listener's audio follows the call volume keys, not the media volume keys"
  - "Playback biases toward the earpiece and sounds call-processed"
  - "Setting AudioManager mode to normal changes nothing"
root_cause: wrong_api
resolution_type: code_fix
severity: high
tags: [android, react-native-webrtc, libwebrtc, audio-attributes, audio-device-module, config-plugin, expo]
---

# Play react-native-webrtc remote audio on Android's media stream

## Problem
On Android, `react-native-webrtc` plays remote audio through libwebrtc's `AudioTrack`, which is built with `USAGE_VOICE_COMMUNICATION`. A listener hearing an interpreter is therefore treated as a phone call: call volume keys, a bias toward the earpiece, and call-tuned processing applied to speech that should be heard as media.

## Symptoms
- The hardware volume keys adjust the call volume, not the media volume the guest expects.
- Audio leans to the earpiece.
- Changing `AudioManager` mode does not move the audio.

## What Didn't Work
- **Setting the audio manager's mode.** Measured on a device: the stream does not move. The attributes are fixed where the `AudioTrack` is created, not read from the current mode (`apps/mobile/modules/hallspeak-audio/android/src/main/java/app/hallspeak/audio/MediaStreamAudioInstaller.kt:13-16`).
- **An application lifecycle hook from an Expo module.** Expo's autolinking dropped that hook after SDK 56, so an Expo module can't run code early enough by itself (`apps/mobile/plugins/with-media-stream-audio.js:15-16`).

## Solution
Give `react-native-webrtc` its own `JavaAudioDeviceModule` built with media attributes, before React Native starts. `WebRTCModuleOptions` is read once when the WebRTC module is constructed.

`MediaStreamAudioInstaller.kt:24-44`:

```kotlin
val options = WebRTCModuleOptions.getInstance()
if (options.audioDeviceModule != null) return

options.audioDeviceModule = JavaAudioDeviceModule.builder(context)
  .setAudioAttributes(
    AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_MEDIA)
      .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
      .build()
  )
  .setUseHardwareAcousticEchoCanceler(false)
  .setUseHardwareNoiseSuppressor(false)
  .setEnableVolumeLogger(false)
  .createAudioDeviceModule()
```

A config plugin (`apps/mobile/plugins/with-media-stream-audio.js`, registered in `apps/mobile/app.json`) injects `app.hallspeak.audio.MediaStreamAudioInstaller.install(this)` into `MainApplication.onCreate`, just before `loadReactNative(this)`. The plugin throws if that anchor is missing (`with-media-stream-audio.js:27-35`). A missed anchor would still build, with the audio silently back on the call stream.

## Why This Works
Android picks the stream, the volume keys and the routing strategy from the `AudioAttributes` a track is created with. libwebrtc creates its track inside the audio device module, so the module is the only place those attributes can be set. Supplying the module moves every remote track onto `USAGE_MEDIA`. Speech-tuned content stays, and the hardware effects that exist for capture are off, since this listener never records.

## Prevention
Moving to the media stream closes some doors. Treat them as settled, not as missing features.

- **No in-app output picker.** `setCommunicationDevice` only affects `USAGE_VOICE_COMMUNICATION` audio. A picker would mean going back to the call stream. `setPreferredDevice` doesn't help either, because libwebrtc's `AudioTrack` can't be reached from outside the audio device module.
- **Don't read the route from `communicationDevice`.** It describes routing that no audio uses. Android has no public call for the media route (`getDevicesForAttributes` is a system API). Instead, the module ranks connected outputs by the precedence Android applies to media: BLE headset, A2DP, wired headset, wired headphones, USB headset, then built-in speaker. The earpiece is left out (`HallspeakAudioModule.kt:238-265`, `ROUTE_PRECEDENCE` at `:324-330`).
- **No iOS-only picker either.** `AVRoutePickerView` works on iOS but is deliberately unused. A control on one platform and not the other is worse than neither.
- **Don't add an in-app volume.** `react-native-webrtc`'s per-track `_setVolume` still works, but it can only lower the level below the device's own, duplicating the hardware keys the media stream already gives the guest.
- If a native rebuild suddenly puts audio back under the call volume keys, first check that the injected call still exists in the generated `MainApplication`.

## Related Issues
- `docs/solutions/operations/diagnosing-live-audio-from-a-user-report.md`, for triaging listener audio complaints.
