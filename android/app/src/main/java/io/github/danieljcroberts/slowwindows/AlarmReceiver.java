package io.github.danieljcroberts.slowwindows;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

// The sunrise alarm going off: a full-screen alarm notification, which opens the app over the lock screen (as alarm
// clocks do), and a plain notification to tap if the phone is in use at the time.
public class AlarmReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "alarm";
    private static final int ID = 2;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Sunrise alarm", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Opens the app for the sunrise alarm");
            ch.setSound(null, null);   // the alarm is light and music, not a ring
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_SUNRISE, true).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 9, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            nm.notify(ID, new NotificationCompat.Builder(ctx, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle("Sunrise")
                .setContentText("Good morning. Tap to open Slow Windows.")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setFullScreenIntent(pi, true)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build());
        } catch (SecurityException e) { }
    }

    static void clearNotification(Context ctx) {
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(ID);
    }
}
