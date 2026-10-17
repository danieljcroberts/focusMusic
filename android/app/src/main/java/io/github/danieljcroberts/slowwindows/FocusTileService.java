package io.github.danieljcroberts.slowwindows;

// The "Focus" Quick Settings tile: opens the app and starts a focus block.
public class FocusTileService extends LaunchTileService {
    @Override protected String reason() { return "focus"; }
}
