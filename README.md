# Slow Windows

Ambient scenes to work beside: rain on a window, a pixel-art forest, an ocean at dusk. Each scene is paired with a Creative Commons track from the [Music For Programming](https://musicforprogramming.net) mixes, and there is a focus timer that dims the scene for breaks.

Everything in it is either drawn in code or licensed for reuse. `CREDITS.md` lists every asset, its author and its licence.

## Run it

```sh
npm install
npm run fetch-music   # downloads the 8 bundled tracks (56 MB, not in git)
npm run dev           # http://localhost:5173
```

`npm run build` writes a static site to `dist/`. Open it from any web server; the page uses relative paths.

Add `#lab` to the URL to see the rain lab: the alternative rain renderers kept for comparison.

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

Keyboard: ← → scenes · Space play/pause · N next track · M scene picks music · T timer · L library · F full screen. On touch, swipe to change scenes.
