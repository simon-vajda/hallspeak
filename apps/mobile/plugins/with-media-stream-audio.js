const { withMainApplication } = require('expo/config-plugins');

const CALL = 'app.hallspeak.audio.MediaStreamAudioInstaller.install(this)';
const ANCHOR = '    loadReactNative(this)';

/**
 * Moves remote WebRTC audio off Android's voice-call stream and onto its media stream.
 *
 * libwebrtc builds its AudioTrack with USAGE_VOICE_COMMUNICATION, which puts a listener's
 * audio under the call volume keys and biases it toward the earpiece. The attributes are
 * chosen where the track is created, so the only way to change them is to hand
 * react-native-webrtc an audio device module built with different ones — and that has to
 * happen before React Native starts, because it reads those options once.
 *
 * Expo's autolinking dropped its application lifecycle listener hook after SDK 56, so the
 * call is injected into MainApplication.onCreate instead.
 */
module.exports = function withMediaStreamAudio(config) {
  return withMainApplication(config, (mod) => {
    if (mod.modResults.contents.includes(CALL)) {
      return mod;
    }

    // Asserted rather than attempted. A missed anchor is the one failure here that produces
    // a working build: prebuild succeeds, and the audio is silently back on the call stream,
    // under the call volume keys and biased to the earpiece, with nothing to notice.
    const next = mod.modResults.contents.replace(ANCHOR, `    ${CALL}\n${ANCHOR}`);

    if (next === mod.modResults.contents) {
      throw new Error(
        `with-media-stream-audio: could not find ${JSON.stringify(ANCHOR)} in MainApplication. ` +
          'Without this call, remote audio plays on the voice-call stream instead of the ' +
          'media stream. Update the anchor to match the current Expo template.',
      );
    }

    mod.modResults.contents = next;

    return mod;
  });
};
