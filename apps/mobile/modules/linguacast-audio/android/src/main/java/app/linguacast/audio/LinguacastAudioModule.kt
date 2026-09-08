package app.linguacast.audio

import android.content.Context
import android.content.Intent
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import android.database.ContentObserver
import android.provider.Settings
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
  private var lastVolume = -1

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  override fun definition() = ModuleDefinition {
    Name("LinguacastAudio")

    Events("onRouteChange", "onVolumeChange", "onRemotePlay", "onRemotePause")

    OnCreate {
      // Android emits no route change of its own, so without this the sheet's Output row
      // keeps whatever it read when it mounted — a headset connected afterwards never
      // reaches it, and the row names a device the audio has already left.
      audioManager.registerAudioDeviceCallback(routeWatcher, Handler(Looper.getMainLooper()))
      context.contentResolver.registerContentObserver(
        Settings.System.CONTENT_URI,
        true,
        volumeWatcher
      )

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

    Function("systemVolume") {
      systemVolume()
    }

    OnDestroy {
      audioManager.unregisterAudioDeviceCallback(routeWatcher)
      context.contentResolver.unregisterContentObserver(volumeWatcher)
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
   * is picked by the same precedence Android itself applies to the media strategy: Bluetooth
   * over a wired headset, a wired headset over the speaker. The earpiece is deliberately
   * absent: media never goes there.
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

  /**
   * Android has no public broadcast for a volume change, so the setting itself is observed.
   * Without it the level the screen states would be frozen at whatever it read on mount, in
   * the same way the route was.
   */
  private val volumeWatcher = object : ContentObserver(Handler(Looper.getMainLooper())) {
    override fun onChange(selfChange: Boolean) {
      // The whole settings table is observed, because the volume key itself is not public,
      // so most of what arrives here is some other setting. Only a real change is emitted.
      val next = systemVolume()

      if (next != lastVolume) {
        lastVolume = next
        sendEvent("onVolumeChange", mapOf("volume" to next))
      }
    }
  }

  /** The device's own media volume as a percentage, which is the only level there now is. */
  private fun systemVolume(): Int {
    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)

    if (max <= 0) {
      return 0
    }

    return audioManager.getStreamVolume(AudioManager.STREAM_MUSIC) * 100 / max
  }

  private val routeWatcher = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<out AudioDeviceInfo>?) = emitRoute()

    override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>?) = emitRoute()
  }

  private fun emitRoute() {
    sendEvent("onRouteChange", mapOf("name" to routeName()))
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
  }
}
