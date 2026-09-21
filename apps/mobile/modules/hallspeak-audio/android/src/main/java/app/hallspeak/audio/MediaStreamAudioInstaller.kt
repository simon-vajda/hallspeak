package app.hallspeak.audio

import android.content.Context
import android.media.AudioAttributes
import com.oney.WebRTCModule.WebRTCModuleOptions
import org.webrtc.audio.JavaAudioDeviceModule

/**
 * Moves remote audio off Android's voice-call stream and onto its media stream.
 *
 * libwebrtc builds its `AudioTrack` with `USAGE_VOICE_COMMUNICATION` and
 * `CONTENT_TYPE_SPEECH`, which puts a listener's audio under the call volume keys, biases it
 * toward the earpiece, and applies call-tuned processing to interpreted speech. Setting the
 * audio manager's mode does not move it — the attributes are chosen where the track is
 * created, so the only way to change them is to hand `react-native-webrtc` an audio device
 * module built with different ones.
 *
 * Called from `MainApplication.onCreate` by this module's config plugin, because the options
 * are read once when the WebRTC module is constructed and Expo's autolinking no longer has
 * an application lifecycle hook of its own.
 */
object MediaStreamAudioInstaller {
  @JvmStatic
  fun install(context: Context) {
    val options = WebRTCModuleOptions.getInstance()

    if (options.audioDeviceModule != null) {
      return
    }

    options.audioDeviceModule = JavaAudioDeviceModule.builder(context)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
          .build()
      )
      // Nothing here captures, and an input the app never opens is one the platform can
      // still show a microphone indicator for.
      .setUseHardwareAcousticEchoCanceler(false)
      .setUseHardwareNoiseSuppressor(false)
      .setEnableVolumeLogger(false)
      .createAudioDeviceModule()
  }
}
