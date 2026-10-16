package io.github.danieljcroberts.slowwindows;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

// The app's one screen: the web app full screen, with the system bars hidden (a swipe brings them back for a moment).
// When the sunrise alarm opens it, it shows over the lock screen and turns the screen on.
public class MainActivity extends BridgeActivity {
    public static final String EXTRA_SUNRISE = "sunrise";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SlowWindowsPlugin.class);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideBars();
        // Music and ambience may start without a tap: the sunrise alarm, and resuming where you left off.
        getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
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

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSunrise(intent);
    }

    private void handleSunrise(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_SUNRISE, false)) return;
        intent.removeExtra(EXTRA_SUNRISE);
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true); }
        AlarmReceiver.clearNotification(this);
        SlowWindowsPlugin.sunrise();
    }
}
