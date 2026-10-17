package io.github.danieljcroberts.slowwindows;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.OutputStream;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// What the web app asks of Android (see src/native.js): keep playing with the screen off, keep the screen on while in
// front, and a real alarm clock for the sunrise alarm.
@CapacitorPlugin(name = "SlowWindows")
public class SlowWindowsPlugin extends Plugin {
    private static SlowWindowsPlugin instance;
    private static String pendingLaunch = "";

    @Override
    public void load() { instance = this; }

    // Called when the app is opened for a reason (the alarm, a Quick Settings tile): tell the page now if it is
    // listening, or when it asks at start-up.
    static void launch(String reason) {
        if (instance != null && instance.hasListeners("launch")) { JSObject o = new JSObject(); o.put("reason", reason); instance.notifyListeners("launch", o); }
        else pendingLaunch = reason;
    }

    @PluginMethod
    public void launchReason(PluginCall call) {
        JSObject r = new JSObject();
        r.put("reason", pendingLaunch);
        pendingLaunch = "";
        call.resolve(r);
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    // The playing track and whether it plays. Starts the playback service the first time music plays; after that it
    // updates it, which also works with the app in the background (a track ending, or a button on the lock screen).
    @PluginMethod
    public void startPlayback(PluginCall call) {
        String title = call.getString("title", "Playing"), artist = call.getString("artist", "");
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", true));
        Context ctx = getContext();
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (PlaybackService.instance != null) PlaybackService.instance.setState(title, artist, playing);
                else if (playing) ContextCompat.startForegroundService(ctx, new Intent(ctx, PlaybackService.class)
                    .setAction(PlaybackService.ACTION_STATE).putExtra("title", title).putExtra("artist", artist).putExtra("playing", true));
            } catch (Exception e) { Logger.error("SlowWindows", "playback service: " + e.getMessage(), e); }
        });
        call.resolve();
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
    }

    // A press on the notification, the lock screen or a headphone button: play, pause, next or prev, for the page.
    static void media(String action) {
        if (instance == null) return;
        JSObject o = new JSObject(); o.put("action", action);
        instance.notifyListeners("media", o);
    }

    // A postcard: a PNG (base64) saved to the phone's pictures, in a "Slow Windows" album.
    @PluginMethod
    public void savePicture(PluginCall call) {
        String data = call.getString("data"), name = call.getString("name", "slow-windows.png");
        if (data == null) { call.reject("data is required"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            ContentResolver cr = getContext().getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            if (Build.VERSION.SDK_INT >= 29) v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Slow Windows");
            Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) { call.reject("no place to save"); return; }
            try (OutputStream out = cr.openOutputStream(uri)) { out.write(bytes); }
            call.resolve();
        } catch (Exception e) { call.reject("could not save: " + e.getMessage()); }
    }

    private PendingIntent alarmOperation(Context ctx) {
        return PendingIntent.getBroadcast(ctx, 7, new Intent(ctx, AlarmReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @PluginMethod
    public void setAlarm(PluginCall call) {
        Double at = call.getDouble("at");
        if (at == null) { call.reject("at is required"); return; }
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent show = PendingIntent.getActivity(ctx, 8, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long t = at.longValue();
        try {
            if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, t, alarmOperation(ctx));
            else am.setAlarmClock(new AlarmManager.AlarmClockInfo(t, show), alarmOperation(ctx));
            call.resolve();
        } catch (SecurityException e) { call.reject("Alarms are not allowed: " + e.getMessage()); }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        am.cancel(alarmOperation(getContext()));
        call.resolve();
    }
}
