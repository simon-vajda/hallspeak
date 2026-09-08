const { withMainApplication } = require('expo/config-plugins');

const CALL = 'app.linguacast.audio.MediaStreamAudioInstaller.install(this)';

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

    mod.modResults.contents = mod.modResults.contents.replace(
      '    loadReactNative(this)',
      `    ${CALL}\n    loadReactNative(this)`,
    );

    return mod;
  });
};
