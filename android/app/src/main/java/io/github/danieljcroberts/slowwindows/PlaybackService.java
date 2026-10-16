package io.github.danieljcroberts.slowwindows;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;

// Runs while music plays, so Android keeps the app alive with the screen off. It shows a quiet, ongoing notification
// with the track's name; tapping it brings the app back.
public class PlaybackService extends Service {
    static volatile boolean running = false;
    private static final String CHANNEL = "playback";
    private static final int ID = 1;
    private PowerManager.WakeLock lock;

    static Notification build(Context ctx, String title) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Playing music", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shown while music plays, so it keeps going with the screen off");
            nm.createNotificationChannel(ch);
        }
        PendingIntent open = PendingIntent.getActivity(ctx, 0, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_icon)
            .setContentTitle("Slow Windows")
            .setContentText(title)
            .setContentIntent(open)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    static void update(Context ctx, String title) {
        try { ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID, build(ctx, title)); } catch (Exception e) { }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "Playing";
        Notification n = build(this, title);
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(ID, n);
        if (lock == null) {
            lock = ((PowerManager) getSystemService(Context.POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SlowWindows:playback");
            lock.acquire(12 * 60 * 60 * 1000L);   // a night at most; released when playback stops
        }
        running = true;
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (lock != null && lock.isHeld()) lock.release();
        lock = null;
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
