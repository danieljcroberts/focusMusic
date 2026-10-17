package io.github.danieljcroberts.slowwindows;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

// A Quick Settings tile that opens the app for a reason (see SlowWindowsPlugin.launch), closing the panel.
public abstract class LaunchTileService extends TileService {
    protected abstract String reason();

    @Override
    public void onStartListening() {
        Tile t = getQsTile();
        if (t != null) { t.setState(Tile.STATE_INACTIVE); t.updateTile(); }
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    @Override
    public void onClick() {
        Intent open = new Intent(this, MainActivity.class).putExtra(MainActivity.EXTRA_LAUNCH, reason())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, reason().hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        } else {
            startActivityAndCollapse(open);
        }
    }
}
