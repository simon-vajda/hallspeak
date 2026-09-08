package app.linguacast.audio

import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Owns the listening session on Android: the media playback foreground service that keeps
 * the audio alive behind another app, and the audio manager's mode.
 *
 * The mode is set to normal rather than left at libwebrtc's communication default, so the
 * audio is a media stream a guest controls with the volume keys they already use, rather
 * than a call under the call volume with a bias toward the earpiece.
 */
class LinguacastAudioModule : Module() {
  private var active = false
  private var playing = false

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  override fun definition() = ModuleDefinition {
    Name("LinguacastAudio")

    Events("onRouteChange", "onRemotePlay", "onRemotePause")

    OnCreate {
      ListeningService.remote = { command ->
        sendEvent(
          when (command) {
            ListeningService.RemoteCommand.PLAY -> "onRemotePlay"
            ListeningService.RemoteCommand.PAUSE -> "onRemotePause"
          }
        )
      }
    }

    AsyncFunction("activate") {
      setSession(true)
    }

    AsyncFunction("deactivate") {
      setSession(false)
    }

    Function("isActive") {
      active
    }

    Function("currentRoute") {
      routeName()
    }

    AsyncFunction("setNowPlaying") { info: Map<String, Any?> ->
      ListeningService.title = info["title"] as? String ?: ""
      ListeningService.subtitle = info["artist"] as? String ?: ""
      ListeningService.active?.publish(playing)
    }

    AsyncFunction("clearNowPlaying") {
      ListeningService.title = ""
      ListeningService.subtitle = ""
      playing = false
    }

    AsyncFunction("setPlaybackState") { next: Boolean ->
      playing = next
      ListeningService.active?.publish(next)
    }

    /**
     * Android's output switcher is reached from the media session this service owns, so the
     * app opens the panel the platform draws rather than listing devices itself.
     */
    AsyncFunction("presentOutputPicker") {
      val intent = Intent(MEDIA_OUTPUT_SWITCHER)
        .putExtra(EXTRA_PACKAGE_NAME, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

      runCatching { context.startActivity(intent) }.onFailure {
        // The panel is not a documented public surface on every build. A device without it
        // leaves the guest the system volume panel's own switcher, which is one press away.
      }
    }

    OnDestroy {
      ListeningService.remote = null
      if (active) {
        setSession(false)
      }
    }
  }

  /**
   * Idempotent in both directions. Starting a second service would throw where the guest
   * cannot see it, and the playback hold deliberately calls activate again while active.
   */
  private fun setSession(next: Boolean) {
    if (next == active) {
      return
    }

    val intent = Intent(context, ListeningService::class.java)

    if (next) {
      audioManager.mode = AudioManager.MODE_NORMAL
      context.startForegroundService(intent)
    } else {
      playing = false
      context.stopService(intent)
    }

    active = next
  }

  /**
   * The device actually carrying the audio, or nothing. A name is never invented: the sheet
   * withholds a label rather than printing one the platform did not give.
   */
  private fun routeName(): String? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      return null
    }

    val device = audioManager.communicationDevice ?: return null

    return when (device.type) {
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Speaker"
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Earpiece"
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Headphones"
      else -> device.productName?.toString()?.takeIf { it.isNotBlank() }
    }
  }

  private companion object {
    const val MEDIA_OUTPUT_SWITCHER = "com.android.settings.panel.action.MEDIA_OUTPUT"
    const val EXTRA_PACKAGE_NAME = "com.android.settings.panel.extra.PACKAGE_NAME"
  }
}
