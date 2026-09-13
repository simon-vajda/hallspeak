---
title: Loop an unmuted silent file so Android grants a WebRTC listener media focus
date: 2026-09-13
category: integration-issues
module: apps/web
problem_type: integration_issue
component: media
symptoms:
  - "Lock-screen and notification media controls do not appear, or vanish, for a web listener on Android"
  - "Interpreted audio keeps playing underneath a song the guest starts in another app"
  - "The page receives no event when another app takes the audio output"
root_cause: browser_incompatibility
resolution_type: code_fix
severity: medium
tags: [android, media-session, audio-focus, webrtc, srcobject, background-playback, lock-screen]
---

# Loop an unmuted silent file so Android grants a WebRTC listener media focus

## Problem
On Android, the browser does not consistently promote an `<audio>` element playing a WebRTC `srcObject` into persistent media focus. A web listener therefore gets unreliable Media Session controls and background playback, and never learns that another app has started playing.

## Symptoms
- System media controls for the channel are missing or disappear.
- Starting music in another app leaves the interpretation playing over it.
- Nothing on the page fires when focus is lost: the WebRTC element keeps running.

## What Didn't Work
- Relying on the WebRTC element alone. The browser treats live communication audio as exempt from focus handling, so it neither qualifies the page for persistent media focus nor gets suspended when focus moves elsewhere.
- Muting the carrier or setting its volume to zero to guarantee silence. Either can stop the browser from making the focus request the carrier exists to trigger.

## Solution
Play a second, silent media file beside the real audio, only while the guest wants to listen.

`apps/web/src/lib/audio/media-session-carrier.ts` builds a six-second WAV in memory (`MEDIA_SESSION_CARRIER_SECONDS = 6`, line 6): 8 kHz, unsigned 8-bit mono PCM filled with `128`, which is digital silence for that format (line 37). The element stays unmuted, and the file makes no sound.

```ts
bytes.fill(128, HEADER_BYTES);
```

`apps/web/src/components/guest/listener-room.tsx` renders it as a separate looping element beside the WebRTC one (`<audio ref={carrierAudio} loop preload="auto" className="hidden" />`, line 444). `startListening` calls `playCarrier()` (line 155), `pauseListening` calls `pauseCarrier()` (line 172), and an effect keeps the carrier in step with the reconciled intent (lines 189-196). Real audio stays on the WebRTC element.

Media Session then describes live content rather than the loop. `apps/web/src/lib/audio/use-listener-media-session.ts:81-85` sets the position state's `duration` to `Number.POSITIVE_INFINITY`, asking supporting system interfaces for a live, non-seekable presentation instead of a six-second scrubber.

The carrier also carries the interruption signal. In `apps/web/src/lib/audio/use-media-session-carrier.ts`, a `pause` event nobody asked for calls `onInterrupted` (lines 37-43), which the listener room wires to `pauseListening` (line 96):

```ts
const paused = () => {
  if (requested.current) {
    requested.current = false;
    return;
  }
  interrupted();
};
```

The app's own pause claims authorship before calling `pause()`, and only when the element is actually playing (lines 69-76):

```ts
const pause = useCallback(() => {
  const element = audio.current;
  if (!element || element.paused) {
    return;
  }
  requested.current = true;
  element.pause();
}, []);
```

## Why This Works
A media file of a known duration of more than five seconds is what Android's browsers promote to persistent media focus; a WebRTC `srcObject` is not consistently promoted (rationale recorded at `media-session-carrier.ts:14-18`). Holding focus through the carrier gives the page the lock-screen controls.

Focus loss is visible the same way. The browser suspends file playback when it loses audio focus but leaves the WebRTC `srcObject` running (`use-media-session-carrier.ts:14-18`). The carrier loops, so it never pauses on its own: every `pause` event has exactly two possible authors, the app or the browser. A pause the app did not claim is the interruption, and stopping the listener is what makes the other app's audio exclusive.

The claim is guarded because `pause()` on an already paused element fires no event. An unconditional claim would stay standing and swallow the next real interruption.

## Prevention
- Never add `muted` or `volume = 0` to the carrier element, and do not replace the silence bytes with a zero-length or sub-five-second file.
- Keep `loop` on the carrier: a carrier that ends on its own would be misread as an interruption.
- Keep the Media Session `duration` at `Infinity` so the loop's length never reaches system UI.
- Any new code path that pauses the carrier must go through the hook's `pause()`, never `element.pause()` directly, or it will be read as an interruption.
- `media-session-carrier.test.ts` covers the generated WAV. The pause-authorship rule is behavioural and must be preserved by review.
- This does not guarantee every mobile OS keeps WebRTC alive in the background; Media Session remains best effort.

## Related Issues
- [Recover a Chromium listener whose page cannot see the new network](recover-a-chromium-listener-whose-page-cannot-see-the-new-network.md) — another Android Chromium listener limitation.
- The mobile app solves the same exclusivity problem natively, with an explicit `AUDIOFOCUS_GAIN` request in its local audio module.
