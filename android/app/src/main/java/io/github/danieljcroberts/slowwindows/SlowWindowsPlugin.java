package io.github.danieljcroberts.slowwindows;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// What the web app asks of Android (see src/native.js): keep playing with the screen off, keep the screen on while in
// front, and a real alarm clock for the sunrise alarm.
@CapacitorPlugin(name = "SlowWindows")
public class SlowWindowsPlugin extends Plugin {
    private static SlowWindowsPlugin instance;
    private static boolean pendingSunrise = false;

    @Override
    public void load() { instance = this; }

    // Called when the alarm opens the app: tell the page now if it is listening, or when it asks at start-up.
    static void sunrise() {
        if (instance != null && instance.hasListeners("sunrise")) instance.notifyListeners("sunrise", new JSObject());
        else pendingSunrise = true;
    }

    @PluginMethod
    public void launchReason(PluginCall call) {
        JSObject r = new JSObject();
        r.put("reason", pendingSunrise ? "sunrise" : "");
        pendingSunrise = false;
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

    @PluginMethod
    public void startPlayback(PluginCall call) {
        String title = call.getString("title", "Playing");
        Context ctx = getContext();
        try {
            if (PlaybackService.running) PlaybackService.update(ctx, title);
            else ContextCompat.startForegroundService(ctx, new Intent(ctx, PlaybackService.class).putExtra("title", title));
            call.resolve();
        } catch (Exception e) { call.reject("Could not start playback service: " + e.getMessage()); }
    }

    @PluginMethod
    public void stopPlayback(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PlaybackService.class));
        call.resolve();
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
