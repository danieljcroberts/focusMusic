package io.github.danieljcroberts.slowwindows;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.util.Rational;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// The app's one screen: the web app full screen, with the system bars hidden (a swipe brings them back for a moment).
// When the sunrise alarm opens it, it shows over the lock screen and turns the screen on.
public class MainActivity extends BridgeActivity {
    public static final String EXTRA_SUNRISE = "sunrise", EXTRA_LAUNCH = "launch";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SlowWindowsPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideBars();
        // Music and ambience may start without a tap: the sunrise alarm, and resuming where you left off.
        WebView web = getBridge().getWebView();
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        // The page (and so the music) runs in the WebView's own renderer process. By default Android lowers that
        // process to background priority whenever the WebView can't be seen, as when the screen turns off, and then
        // freezes it, which stops the music. Keep it important even when invisible; the playback service keeps the
        // app's own process alive alongside it.
        if (Build.VERSION.SDK_INT >= 26) web.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        handleSunrise(getIntent());
    }

    private void hideBars() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.hide(WindowInsetsCompat.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    // Picture-in-picture: when the app is left (Home, or the app switcher) and the option is on, the scene keeps
    // playing in a small window. The page is told, so it can hide its controls.
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (SlowWindowsPlugin.pipWanted && Build.VERSION.SDK_INT >= 26 && Build.VERSION.SDK_INT < 31) {
            try { enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9)).build()); } catch (Exception e) { }
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(inPip, newConfig);
        SlowWindowsPlugin.pip(inPip);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSunrise(intent);
    }

    // Opened by the sunrise alarm (over the lock screen, screen on) or by a Quick Settings tile (focus, bedtime).
    private void handleSunrise(Intent intent) {
        if (intent == null) return;
        String launch = intent.getStringExtra(EXTRA_LAUNCH);
        if (launch != null) { intent.removeExtra(EXTRA_LAUNCH); SlowWindowsPlugin.launch(launch); }
        if (!intent.getBooleanExtra(EXTRA_SUNRISE, false)) return;
        intent.removeExtra(EXTRA_SUNRISE);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        AlarmReceiver.clearNotification(this);
        SlowWindowsPlugin.launch("sunrise");
    }
}
