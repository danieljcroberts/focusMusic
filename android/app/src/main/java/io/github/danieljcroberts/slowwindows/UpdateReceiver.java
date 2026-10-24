package io.github.danieljcroberts.slowwindows;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

// What Android's package installer says about an update the app handed it (SlowWindowsPlugin.install): it first asks
// for the person's go-ahead, which this shows; then it reports the outcome. A successful update replaces the app.
public class UpdateReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) { confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); ctx.startActivity(confirm); }
            SlowWindowsPlugin.installResult("install", null);
        } else if (status == PackageInstaller.STATUS_SUCCESS) {
            SlowWindowsPlugin.installResult("installed", null);
        } else if (status == PackageInstaller.STATUS_FAILURE_ABORTED) {
            SlowWindowsPlugin.installResult("cancelled", null);
        } else {
            String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            SlowWindowsPlugin.installResult("failed", msg != null ? msg : "the installer said no (" + status + ")");
        }
    }
}
