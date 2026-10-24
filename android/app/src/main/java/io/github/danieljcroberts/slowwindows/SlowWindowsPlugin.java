package io.github.danieljcroberts.slowwindows;

import android.app.AlarmManager;
import java.io.InputStream;
import java.io.FileInputStream;
import androidx.core.content.pm.PackageInfoCompat;
import androidx.core.app.NotificationCompat;
import android.app.NotificationManager;
import android.app.NotificationChannel;
import android.content.pm.PackageManager;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageInfo;
import android.app.DownloadManager;
import android.database.Cursor;
import android.provider.Settings;
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

    // Updates, without the phone's "open with" choice in the way. Android's download manager fetches the APK into the
    // app's own folder, watched here every moment (so a missed broadcast can't lose it); then the file goes straight to
    // Android's package installer through an install session, which shows its own Update screen. (Handing it over as a
    // file to "view" let a default chosen once, such as a system-update app, take it and do nothing.) If the download
    // finishes while the app is in the background, a notification offers the install, and so does the app when it comes
    // back. The first time, Android asks to allow installs from this app. Events to the page ("update"): progress (pct),
    // ready, permission, install (the installer is showing), denied, failed (msg).
    private static final String PREFS = "sw-update";
    private static final String CHANNEL_UPDATES = "updates";
    private long updateId = -1;
    private File updateFile;
    private final Handler updateTick = new Handler(Looper.getMainLooper());
    private boolean installPending = false, inFront = false;

    private void updateEvent(String state, int pct) { updateEvent(state, pct, null); }
    private void updateEvent(String state, int pct, String msg) {
        JSObject o = new JSObject(); o.put("state", state); o.put("pct", pct); if (msg != null) o.put("msg", msg);
        notifyListeners("update", o, true);   // kept until the page listens, if it isn't yet
    }
    // From UpdateReceiver: what the installer said.
    static void installResult(String state, String msg) { if (instance != null) instance.updateEvent(state, 100, msg); }

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
            updateTick.removeCallbacksAndMessages(null);
            updateId = dm.enqueue(r);
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("file", updateFile.getAbsolutePath()).apply();
            updateTick.post(new Runnable() { @Override public void run() {
                try (Cursor q = dm.query(new DownloadManager.Query().setFilterById(updateId))) {
                    if (q == null || !q.moveToFirst()) { updateEvent("failed", 0, "the download was cancelled"); return; }
                    int status = q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if (status == DownloadManager.STATUS_SUCCESSFUL) { downloaded(); return; }
                    if (status == DownloadManager.STATUS_FAILED) { updateEvent("failed", 0, "the download failed (code " + q.getInt(q.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)) + ")"); return; }
                    long got = q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)), all = q.getLong(q.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                    if (all > 0) updateEvent("progress", (int) (got * 100 / all));
                } catch (Exception e) { Logger.error("update poll", e); }
                updateTick.postDelayed(this, 700);
            } });
            call.resolve();
        } catch (Exception e) { call.reject("Couldn't start the download: " + e.getMessage()); }
    }

    // A downloaded update that is really a newer build of this app.
    private boolean isNewer(File f) {
        if (f == null || !f.exists() || f.length() == 0) return false;
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo apk = pm.getPackageArchiveInfo(f.getAbsolutePath(), 0), mine = pm.getPackageInfo(getContext().getPackageName(), 0);
            return apk != null && getContext().getPackageName().equals(apk.packageName) && PackageInfoCompat.getLongVersionCode(apk) > PackageInfoCompat.getLongVersionCode(mine);
        } catch (Exception e) { return false; }
    }

    private void downloaded() {
        if (!isNewer(updateFile)) { updateEvent("failed", 0, "the downloaded file isn't a newer version of the app"); return; }
        updateEvent("ready", 100);
        if (inFront) install();
        else { installPending = true; notifyReady(); }
    }

    // The download finished with the app in the background: a notification that brings it back to install.
    private void notifyReady() {
        Context ctx = getContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL_UPDATES) == null)
            nm.createNotificationChannel(new NotificationChannel(CHANNEL_UPDATES, "App updates", NotificationManager.IMPORTANCE_HIGH));
        Intent open = new Intent(ctx, MainActivity.class).putExtra("installUpdate", true).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, 7, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        try {
            nm.notify(7, new NotificationCompat.Builder(ctx, CHANNEL_UPDATES).setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle("Slow Windows update ready").setContentText("Tap to install it.").setContentIntent(tap).setAutoCancel(true).build());
        } catch (SecurityException e) { /* notifications are off: the app offers it when it comes back */ }
    }

    // From the page: install a downloaded update now (the "Install" button).
    @PluginMethod
    public void installUpdate(PluginCall call) {
        if (updateFile == null) { String path = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("file", null); if (path != null) updateFile = new File(path); }
        if (!isNewer(updateFile)) { call.reject("no update downloaded"); return; }
        install(); call.resolve();
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
        ((NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(7);
        final File apk = updateFile;
        new Thread(() -> {
            try {
                PackageInstaller pi = ctx.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(ctx.getPackageName());
                int id = pi.createSession(params);
                try (PackageInstaller.Session session = pi.openSession(id)) {
                    try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
                        byte[] buf = new byte[1 << 16]; int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                        session.fsync(out);
                    }
                    Intent done = new Intent(ctx, UpdateReceiver.class);
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
                    session.commit(PendingIntent.getBroadcast(ctx, id, done, flags).getIntentSender());
                }
            } catch (Exception e) { Logger.error("update install", e); updateEvent("failed", 0, "the installer couldn't start (" + e.getMessage() + ")"); }
        }).start();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        inFront = true;
        // Opened from the "update ready" notification, or back from the "install unknown apps" setting.
        if (getActivity() != null && getActivity().getIntent() != null && getActivity().getIntent().getBooleanExtra("installUpdate", false)) {
            getActivity().getIntent().removeExtra("installUpdate");
            if (updateFile == null) { String path = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("file", null); if (path != null) updateFile = new File(path); }
            installPending = isNewer(updateFile);
        }
        if (installPending && isNewer(updateFile)) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls()) install();
            else { installPending = false; updateEvent("denied", 0); }
        }
    }

    @Override
    protected void handleOnPause() { super.handleOnPause(); inFront = false; }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent.getBooleanExtra("installUpdate", false)) { if (getActivity() != null) getActivity().setIntent(intent); }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        am.cancel(alarmOperation(getContext()));
        call.resolve();
    }
}
