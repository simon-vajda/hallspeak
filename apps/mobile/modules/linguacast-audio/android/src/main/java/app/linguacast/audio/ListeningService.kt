package app.linguacast.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.session.MediaButtonReceiver

/**
 * Keeps the process alive while a guest is listening, and carries the media session the
 * system's own controls and output switcher read.
 *
 * Android stops giving a backgrounded app CPU and network long before it stops a service in
 * the foreground, so without this the audio ends the moment the phone goes in a pocket.
 * Started only while the app itself is in the foreground — Android refuses a start from the
 * background — which is why the playback hold keeps it running rather than stopping it and
 * starting it again when the interpreter returns.
 */
class ListeningService : Service() {
  private var session: MediaSessionCompat? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val ticker = Handler(Looper.getMainLooper())
  private val tick = object : Runnable {
    override fun run() {
      onTick?.invoke()
      ticker.postDelayed(this, TICK_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()

    val created = MediaSessionCompat(this, "LinguaCast").apply {
      setCallback(object : MediaSessionCompat.Callback() {
        override fun onPlay() {
          remote?.invoke(RemoteCommand.PLAY)
        }

        override fun onPause() {
          remote?.invoke(RemoteCommand.PAUSE)
        }
      })
      isActive = true
    }

    session = created
    active = this
    holdCpu()
    ticker.postDelayed(tick, TICK_MS)
    // From the shared state rather than from a parameter: the module sets what it wants
    // before the service exists, and a service that published its own idea of the state
    // would show a play button over audio that is already flowing.
    publish()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    session?.let { MediaButtonReceiver.handleIntent(it, intent) }
    startForeground(NOTIFICATION_ID, notification())
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    ticker.removeCallbacks(tick)
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
    session?.isActive = false
    session?.release()
    session = null
    active = null
    super.onDestroy()
  }

  /**
   * Android suspends the CPU behind a locked screen unless something holds it, and a
   * foreground service is not that something. While audio is flowing the audio path keeps
   * the device awake on its own; the moment a network change stops it, nothing does — which
   * is exactly the moment the recovery has work to do.
   */
  private fun holdCpu() {
    val manager = getSystemService(PowerManager::class.java) ?: return
    wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  /**
   * Play and pause only, and a duration the platform reads as unknown, which is what keeps
   * a seek bar out of the notification and off the lock screen.
   */
  fun publish() {
    val current = session ?: return

    current.setMetadata(
      MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, subtitle)
        .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, DURATION_UNKNOWN)
        .build()
    )

    current.setPlaybackState(
      PlaybackStateCompat.Builder()
        .setActions(PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE)
        .setState(
          if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED,
          PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
          if (playing) 1f else 0f
        )
        .build()
    )

    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
  }

  private fun notification(): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Listening", NotificationManager.IMPORTANCE_LOW).apply {
          setShowBadge(false)
        }
      )
    }

    val label = applicationInfo.loadLabel(packageManager).toString()
    val toggle = if (playing) {
      NotificationCompat.Action(
        android.R.drawable.ic_media_pause,
        "Pause",
        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PAUSE)
      )
    } else {
      NotificationCompat.Action(
        android.R.drawable.ic_media_play,
        "Play",
        MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY)
      )
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title.ifBlank { label })
      // The event, and the app's own name beside it: a notification a guest meets on a lock
      // screen has to say which app is holding their audio.
      .setContentText(subtitle.ifBlank { label })
      .setSubText(label)
      // Reopens the app where the guest left it, which is the channel they are listening to.
      .setContentIntent(reopen())
      .setOngoing(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .addAction(toggle)
      .setStyle(
        androidx.media.app.NotificationCompat.MediaStyle()
          .setMediaSession(session?.sessionToken)
          .setShowActionsInCompactView(0)
      )
      .build()
  }

  private fun reopen(): PendingIntent? {
    val intent = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    // Brings the existing task forward rather than starting a second copy of the app, so the
    // guest lands back on the channel they were listening to.
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP

    return PendingIntent.getActivity(
      this,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  enum class RemoteCommand { PLAY, PAUSE }

  companion object {
    const val CHANNEL_ID = "linguacast-listening"
    const val NOTIFICATION_ID = 4711

    private const val WAKE_LOCK_TAG = "linguacast:listening"

    /** Often enough that a dropped link recovers within a sentence, rare enough to ignore. */
    private const val TICK_MS = 2_000L

    /** MediaSession reads a negative duration as unknown, which is what withholds the bar. */
    private const val DURATION_UNKNOWN = -1L

    /**
     * What the controls should say, held here rather than on the instance: the module sets
     * all three before `startForegroundService` has produced a service to receive them.
     */
    var title: String = ""
    var subtitle: String = ""
    var playing: Boolean = false

    /** The module's own handler, so a lock-screen press reaches JavaScript. */
    var remote: ((RemoteCommand) -> Unit)? = null

    /**
     * The heartbeat the recovery runs on. React Native pauses JavaScript timers while the
     * app is not visible, so every deadline the listener owns — the ICE ladder's, and the
     * socket's own reconnection backoff — stops being due until a guest looks at the phone.
     * A native tick is a clock the operating system does not pause.
     */
    var onTick: (() -> Unit)? = null

    /** The running instance, so the module can republish without binding. */
    var active: ListeningService? = null
      private set
  }
}
