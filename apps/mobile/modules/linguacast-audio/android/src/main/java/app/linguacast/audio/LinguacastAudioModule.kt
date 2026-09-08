package app.linguacast.audio

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
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
 * The mode is set to normal rather than left at libwebrtc's communication default. That
 * alone does not move the audio — the track's own attributes decide that, which is what
 * `MediaStreamAudioInstaller` is for — but leaving the mode at communication would still
 * duck other audio and hold the routing a call expects.
 */
class LinguacastAudioModule : Module() {
  private var active = false

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
      ListeningService.active?.publish()
    }

    AsyncFunction("clearNowPlaying") {
      ListeningService.title = ""
      ListeningService.subtitle = ""
      ListeningService.playing = false
    }

    // Written to the shared state whether or not a service exists yet: activation is
    // asynchronous, so this routinely arrives first, and a service that then published its
    // own default would show a play button over audio that is already flowing.
    AsyncFunction("setPlaybackState") { next: Boolean ->
      ListeningService.playing = next
      ListeningService.active?.publish()
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
      ListeningService.playing = false
      context.stopService(intent)
    }

    active = next
  }

  /**
   * The device the media stream is going to, or nothing. A name is never invented: the sheet
   * withholds a label rather than printing one the platform did not give.
   *
   * Android exposes no public "which output is media on" call — `getDevicesForAttributes` is
   * a system API — so the connected outputs are read and the one the platform would route to
   * is picked by the same precedence Android itself applies: a wired headset over Bluetooth,
   * Bluetooth over the speaker. The earpiece is deliberately absent: media never goes there.
   */
  private fun routeName(): String? {
    val outputs = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)

    for (type in ROUTE_PRECEDENCE) {
      val device = outputs.firstOrNull { it.type == type } ?: continue

      return when (type) {
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Headphones"
        AudioDeviceInfo.TYPE_USB_HEADSET -> "USB headphones"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Speaker"
        else -> device.productName?.toString()?.takeIf { it.isNotBlank() } ?: "Bluetooth"
      }
    }

    return null
  }

  private companion object {
    /** Android's own routing order for media, which is what the row has to agree with. */
    val ROUTE_PRECEDENCE = listOf(
      AudioDeviceInfo.TYPE_BLE_HEADSET,
      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
      AudioDeviceInfo.TYPE_USB_HEADSET,
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER,
    )

    const val MEDIA_OUTPUT_SWITCHER = "com.android.settings.panel.action.MEDIA_OUTPUT"
    const val EXTRA_PACKAGE_NAME = "com.android.settings.panel.extra.PACKAGE_NAME"
  }
}
