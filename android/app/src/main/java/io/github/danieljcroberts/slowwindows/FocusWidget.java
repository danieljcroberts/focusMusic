package io.github.danieljcroberts.slowwindows;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

// The home-screen widget: today's focus minutes and the day streak (written by the page through the plugin), and a
// Start button that opens the app on a focus block.
public class FocusWidget extends AppWidgetProvider {
    static final String PREFS = "widget";

    static void save(Context ctx, int minutes, int streak, boolean running) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putInt("minutes", minutes).putInt("streak", streak).putBoolean("running", running).apply();
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, FocusWidget.class))) draw(ctx, m, id);
    }

    static void draw(Context ctx, AppWidgetManager m, int id) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int minutes = p.getInt("minutes", 0), streak = p.getInt("streak", 0);
        boolean running = p.getBoolean("running", false);
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_focus);
        v.setTextViewText(R.id.widget_minutes, minutes >= 60 ? (minutes / 60) + " h " + (minutes % 60) + " min" : minutes + " min");
        v.setTextViewText(R.id.widget_streak, streak == 0 ? "No streak yet" : streak + " day streak");
        v.setTextViewText(R.id.widget_start, running ? "Running" : "Start");
        Intent open = new Intent(ctx, MainActivity.class).putExtra(MainActivity.EXTRA_LAUNCH, running ? "" : "focus").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, running ? 21 : 20, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.widget_start, pi);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(ctx, 22, new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        m.updateAppWidget(id, v);
    }

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) { for (int id : ids) draw(ctx, m, id); }
}
