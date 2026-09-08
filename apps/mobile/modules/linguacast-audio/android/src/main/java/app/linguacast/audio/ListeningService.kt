package app.linguacast.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
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
    publish(playing = false)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    session?.let { MediaButtonReceiver.handleIntent(it, intent) }
    startForeground(NOTIFICATION_ID, notification())
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    session?.release()
    session = null
    active = null
    super.onDestroy()
  }

  /**
   * Play and pause only, and a duration the platform reads as unknown, which is what keeps
   * a seek bar out of the notification and off the lock screen.
   */
  fun publish(playing: Boolean) {
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

    if (session != null) {
      getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, notification())
    }
  }

  private fun notification(): Notification {
    val manager = getSystemService(NotificationManager::class.java)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Listening", NotificationManager.IMPORTANCE_LOW).apply {
          setShowBadge(false)
        }
      )
    }

    val label = applicationInfo.loadLabel(packageManager).toString()

    return Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(title.ifBlank { label })
      .setContentText(subtitle)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setStyle(
        Notification.MediaStyle().setMediaSession(session?.sessionToken?.token as? android.media.session.MediaSession.Token)
      )
      .build()
  }

  enum class RemoteCommand { PLAY, PAUSE }

  companion object {
    const val CHANNEL_ID = "linguacast-listening"
    const val NOTIFICATION_ID = 4711

    /** MediaSession reads a negative duration as unknown, which is what withholds the bar. */
    private const val DURATION_UNKNOWN = -1L

    /** Set by the module before the service starts, and read back by the notification. */
    var title: String = ""
    var subtitle: String = ""

    /** The module's own handler, so a lock-screen press reaches JavaScript. */
    var remote: ((RemoteCommand) -> Unit)? = null

    /** The running instance, so the module can republish without binding. */
    var active: ListeningService? = null
      private set
  }
}
