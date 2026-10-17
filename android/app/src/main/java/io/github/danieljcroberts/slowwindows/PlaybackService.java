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
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;

// The app as a music player to Android. While music plays it runs in the foreground, so Android keeps the app alive with
// the screen off. Its notification, the lock screen and headphone or car buttons show the track and control playback
// (previous, play or pause, next) through a media session; those presses go to the page through SlowWindowsPlugin.
// When paused, the notification stays (and can be swiped away) and the app is no longer held in the foreground.
public class PlaybackService extends Service {
    static volatile boolean running = false;
    static PlaybackService instance;
    static final String ACTION_STATE = "state", ACTION_PLAY = "play", ACTION_PAUSE = "pause", ACTION_NEXT = "next", ACTION_PREV = "prev", ACTION_DISMISS = "dismiss";
    private static final String CHANNEL = "playback";
    private static final int ID = 1;
    private PowerManager.WakeLock lock;
    private MediaSessionCompat session;
    private String title = "Slow Windows", artist = "";
    private boolean playing = false, foreground = false;

    @Override
    public void onCreate() {
        super.onCreate();
        session = new MediaSessionCompat(this, "SlowWindows");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { SlowWindowsPlugin.media(ACTION_PLAY); }
            @Override public void onPause() { SlowWindowsPlugin.media(ACTION_PAUSE); }
            @Override public void onSkipToNext() { SlowWindowsPlugin.media(ACTION_NEXT); }
            @Override public void onSkipToPrevious() { SlowWindowsPlugin.media(ACTION_PREV); }
            @Override public void onStop() { SlowWindowsPlugin.media(ACTION_PAUSE); }
        });
        session.setSessionActivity(PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        session.setActive(true);
        running = true; instance = this;
    }

    private PendingIntent action(String a, int code) {
        return PendingIntent.getService(this, code, new Intent(this, PlaybackService.class).setAction(a), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification build() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Playing music", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Shows the playing track, with controls, and keeps music going with the screen off");
            nm.createNotificationChannel(ch);
        }
        return new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_icon)
            .setContentTitle(title)
            .setContentText(artist.isEmpty() ? "Slow Windows" : artist)
            .setContentIntent(session.getController().getSessionActivity())
            .setDeleteIntent(action(ACTION_DISMISS, 15))
            .addAction(R.drawable.ic_media_prev, "Previous", action(ACTION_PREV, 11))
            .addAction(playing ? R.drawable.ic_media_pause : R.drawable.ic_media_play, playing ? "Pause" : "Play", action(playing ? ACTION_PAUSE : ACTION_PLAY, 12))
            .addAction(R.drawable.ic_media_next, "Next", action(ACTION_NEXT, 13))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle().setMediaSession(session.getSessionToken()).setShowActionsInCompactView(0, 1, 2))
            .setOngoing(playing)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private void apply() {
        session.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Slow Windows")
            .build());
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
                | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS | PlaybackStateCompat.ACTION_STOP)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
            .build());
        Notification n = build();
        if (playing) {
            if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            else startForeground(ID, n);
            foreground = true;
            if (lock == null) {
                lock = ((PowerManager) getSystemService(Context.POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SlowWindows:playback");
                lock.acquire(12 * 60 * 60 * 1000L);   // a night at most; let go when the music pauses
            }
        } else {
            if (foreground && Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH);
            foreground = false;
            releaseLock();
            try { ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify(ID, n); } catch (Exception e) { }
        }
    }

    // From the page, while the service is running: the track and whether it plays. Call on the main thread.
    void setState(String t, String a, boolean p) { title = t; artist = a == null ? "" : a; playing = p; apply(); }

    private void releaseLock() { if (lock != null && lock.isHeld()) lock.release(); lock = null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null && intent.getAction() != null ? intent.getAction() : ACTION_STATE;
        switch (a) {
            case ACTION_STATE:
                if (intent != null) {
                    if (intent.getStringExtra("title") != null) title = intent.getStringExtra("title");
                    artist = intent.getStringExtra("artist") != null ? intent.getStringExtra("artist") : "";
                    playing = intent.getBooleanExtra("playing", true);
                }
                apply();
                break;
            case ACTION_PLAY:
                playing = true; apply();   // straight into the foreground, as Android expects; the page confirms in a moment
                SlowWindowsPlugin.media(ACTION_PLAY);
                break;
            case ACTION_DISMISS:
                stopSelf();
                break;
            default:
                if (foreground || !playing) apply();   // a service started from a button must show its notification promptly
                SlowWindowsPlugin.media(a);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false; instance = null;
        releaseLock();
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        try { ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).cancel(ID); } catch (Exception e) { }
        session.setActive(false);
        session.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
