package app.linguacast.audio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder

/**
 * Keeps the process alive while a guest is listening. Android stops giving a backgrounded
 * app CPU and network long before a service in the foreground, so without this the audio
 * ends the moment the phone goes in a pocket.
 *
 * Started only while the app itself is in the foreground — Android refuses a start from the
 * background — which is why the playback hold keeps it running rather than stopping it and
 * starting it again when the interpreter returns.
 */
class ListeningService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    startForeground(NOTIFICATION_ID, notification())
    return START_NOT_STICKY
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
      .setContentTitle(label)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .build()
  }

  companion object {
    const val CHANNEL_ID = "linguacast-listening"
    const val NOTIFICATION_ID = 4711
  }
}
