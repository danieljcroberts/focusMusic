package io.github.danieljcroberts.slowwindows;

import android.app.AlarmManager;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.database.Cursor;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import java.io.File;
import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.WallpaperManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Rational;
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

    // The scene as the phone's wallpaper: a PNG (base64) for the home screen, the lock screen or both.
    @PluginMethod
    public void setWallpaper(PluginCall call) {
        String data = call.getString("data"), which = call.getString("which", "both");
        if (data == null) { call.reject("data is required"); return; }
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                WallpaperManager wm = WallpaperManager.getInstance(getContext());
                if (Build.VERSION.SDK_INT >= 24) {
                    int flags = which.equals("home") ? WallpaperManager.FLAG_SYSTEM : which.equals("lock") ? WallpaperManager.FLAG_LOCK : WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK;
                    wm.setBitmap(bmp, null, true, flags);
                } else wm.setBitmap(bmp);
                call.resolve();
            } catch (Exception e) { call.reject("could not set the wallpaper: " + e.getMessage()); }
        }).start();
    }

    // Today's focus minutes and the streak, for the home-screen widget.
    @PluginMethod
    public void setWidgetData(PluginCall call) {
        FocusWidget.save(getContext(), call.getInt("minutes", 0), call.getInt("streak", 0), Boolean.TRUE.equals(call.getBoolean("running", false)));
        call.resolve();
    }

    // Picture-in-picture when the app is left: on or off. Android 12 and later can enter it as the gesture happens.
    static volatile boolean pipWanted = false;
    @PluginMethod
    public void setPip(PluginCall call) {
        pipWanted = Boolean.TRUE.equals(call.getBoolean("on", false));
        if (Build.VERSION.SDK_INT >= 31) getActivity().runOnUiThread(() -> { try { getActivity().setPictureInPictureParams(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).setAutoEnterEnabled(pipWanted).setSeamlessResizeEnabled(false).build()); } catch (Exception e) { } });
        call.resolve();
    }
    static void pip(boolean in) {
        if (instance == null) return;
        JSObject o = new JSObject(); o.put("in", in);
        instance.notifyListeners("pip", o);
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

    // Updates: the APK is fetched by Android's download manager (with its own progress notification) into the app's
    // own folder, then handed to the package installer. The first time, Android asks to allow installs from this app;
    // the install carries on when the person comes back from that setting. Progress and the outcome go to the page as
    // "update" events: progress (pct), install, permission, failed.
    private long updateId = -1;
    private File updateFile;
    private BroadcastReceiver updateDone;
    private final Handler updateTick = new Handler(Looper.getMainLooper());

    private void updateEvent(String state, int pct) {
        JSObject o = new JSObject(); o.put("state", state); o.put("pct", pct); notifyListeners("update", o);
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String url = call.getString("url"), name = call.getString("name", "slow-windows-update.apk");
        if (url == null) { call.reject("no url"); return; }
        Context ctx = getContext();
        try {
            File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) { call.reject("no download folder"); return; }
            File[] old = dir.listFiles((d, n) -> n.endsWith(".apk"));
            if (old != null) for (File f : old) f.delete();
            updateFile = new File(dir, name);
            DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url))
                .setTitle("Slow Windows update").setDescription(name)
                .setMimeType("application/vnd.android.package-archive")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                .setDestinationUri(Uri.fromFile(updateFile));
            if (updateDone != null) { try { ctx.unregisterReceiver(updateDone); } catch (Exception e) {} }
            updateDone = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    if (i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -2) != updateId) return;
                    updateTick.removeCallbacksAndMessages(null);
                    try { c.unregisterReceiver(this); } catch (Exception e) {}
                    updateDone = null;
                    if (statusOf(dm) == DownloadManager.STATUS_SUCCESSFUL && updateFile.length() > 0) install();
                    else updateEvent("failed", 0);
                }
            };
            ContextCompat.registerReceiver(ctx, updateDone, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_EXPORTED);
            updateId = dm.enqueue(r);
            updateTick.post(new Runnable() { @Override public void run() {
                try (Cursor q = dm.query(new DownloadManager.Query().setFilterById(updateId))) {
                    if (q != null && q.moveToFirst()) {
                        long got = q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)), all = q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                        if (all > 0) updateEvent("progress", (int) (got * 100 / all));
                    }
                } catch (Exception e) {}
                updateTick.postDelayed(this, 700);
            } });
            call.resolve();
        } catch (Exception e) { call.reject("Couldn't start the download: " + e.getMessage()); }
    }

    // A link opened in the phone's browser rather than inside the app.
    @PluginMethod
    public void openExternal(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url")));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i); call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    private int statusOf(DownloadManager dm) {
        try (Cursor q = dm.query(new DownloadManager.Query().setFilterById(updateId))) {
            if (q != null && q.moveToFirst()) return q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
        } catch (Exception e) {}
        return -1;
    }

    private boolean installPending = false;
    private void install() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !ctx.getPackageManager().canRequestPackageInstalls()) {
            installPending = true; updateEvent("permission", 100);
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(s);
            return;
        }
        installPending = false;
        try {
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", updateFile);
            Intent i = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            updateEvent("install", 100);
        } catch (Exception e) { Logger.error("update install", e); updateEvent("failed", 0); }
    }

    // Back from the "install unknown apps" setting: carry on with the install if it was allowed.
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (installPending && updateFile != null && updateFile.exists()) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls()) install();
            else { installPending = false; updateEvent("denied", 0); }
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        am.cancel(alarmOperation(getContext()));
        call.resolve();
    }
}
