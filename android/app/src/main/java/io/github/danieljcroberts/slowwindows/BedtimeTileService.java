package io.github.danieljcroberts.slowwindows;

// The "Bedtime" Quick Settings tile: opens the app with calm music, the night sky and the sleep timer.
public class BedtimeTileService extends LaunchTileService {
    @Override protected String reason() { return "bedtime"; }
}
