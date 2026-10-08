# Slow Windows

Ambient scenes to work beside: rain on a window, a pixel-art forest, an ocean at dusk. Each scene is paired with a Creative Commons track from the [Music For Programming](https://musicforprogramming.net) mixes, and there is a focus timer that dims the scene for breaks.

Everything in it is either drawn in code or licensed for reuse. `CREDITS.md` lists every asset, its author and its licence.

**Slow Windows is free and will stay free.** Most of the music is Creative Commons non-commercial (BY-NC, BY-NC-SA, BY-NC-ND), which rules out selling the app, charging for access, or running ads. Any contribution has to fit that: no NC-incompatible monetisation, ever.

## Run it

```sh
npm install
npm run fetch-music   # downloads the 8 bundled tracks (56 MB, not in git)
npm run dev           # http://localhost:5173
```

`npm run build` writes a static site to `dist/`. Open it from any web server; the page uses relative paths.

Add `#lab` to the URL to see the rain lab: the alternative rain renderers kept for comparison.

Lighthouse, Above the Clouds, Pond, Low Tide and Aurora follow your clock: daylight from about 06:00, dusk around 18:00 to 19:30, night after. There is no location lookup, so the times are fixed.

Each scene has an ambient sound layer (rain, wind, sea, fire, a café, a train, a storm, bubbles, a low hum) generated in Web Audio from filtered noise, with nothing to download. The **Ambience** slider sets its level; it follows the weather where that makes sense and starts after your first click or key, as browsers require.

The Trip group is eight full-screen shaders that move with the music (bass, mid and treble from the analyser; a gentle pulse when the player can't be analysed). They are slow and never flash. **Lively** (top bar, or V) speeds them up and lets the music push harder.

## Check it

```sh
npm run check   # scene and track data agree with each other and with the files on disk
npm run smoke   # opens the built site in headless Chromium and steps through every scene
npm test        # both, with a build in between
```

## Layout

```
index.html            page markup
src/main.js           boot, scene switching, timer, keys, swipe, idle and wake lock
src/music.js          players, crossfades, the library and the Internet Archive live source
src/data/scenes.js    scene metadata: names, descriptions, art credits, paired tracks
src/data/tracks.json  the Creative Commons tracks with licence, episodes and source
src/scenes/           the renderers: drawn.js, parallax.js, glass.js, ocean.js, lab.js
public/assets/scenes  scene art (in git)
public/assets/music   bundled tracks (fetched, not in git)
scripts/              check, fetch-music, smoke
```

Keyboard: ← → scenes · Space play/pause · N next track · M scene picks music · S favourite · D drift · V lively · T timer · L library · F full screen.

Star scenes with **Favourite**; **Drift** then moves between them (or all scenes, if none are starred) every 10, 20 or 30 minutes. **Settings** holds the weather and time-of-day overrides, the drift interval, and "Save music for offline use", which fetches the bundled tracks into the browser cache.

The built site is an installable PWA: a service worker caches the page, code and scene assets as they are seen, so scenes work offline after one visit; the music works offline once saved from Settings. On touch, swipe to change scenes.
