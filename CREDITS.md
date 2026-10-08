# Slow Windows: asset credits

Licences checked on 2026-10-06. Recheck before shipping.

## Scenes drawn in code (original)

Canopy, Night Drive, Hearth, Low Tide and Aurora are drawn procedurally in `src/scenes/drawn.js`; Lighthouse, Night Train, Storm on the Plain, Above the Clouds, Pond and Aquarium in `src/scenes/places.js`. Windscreen and Greenhouse use backdrops drawn in `src/scenes/glass-shared.js`. The Trip scenes (`src/scenes/trip.js`) are original shaders; their colour palettes use the cosine-palette technique described by Inigo Quilez, which is a method, not a licensed asset. They use no third-party art. Rain on Glass, Snow on Glass and Café Window (`src/scenes/glass.js`) and the rain lab renderers (`src/scenes/lab.js`, shown with `#lab`) are also original code; over the "Drawn city" background they use no third-party art, and the photo backgrounds are listed below.

## Photographs and footage

| Used in | Asset | Author | Licence | Source |
|---|---|---|---|---|
| Background "Blue-hour waterfront" | City lighting (resized, blurred in the scene) | Maria Eklind | CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:City_lighting_(explore)_-_Flickr_-_Maria_Eklind.jpg |
| Background "Tokyo at night" | Roppongi at night seen from Shibuya Stream (resized) | Syced | CC0 | https://commons.wikimedia.org/wiki/File:Roppongi_at_night_seen_from_Shibuya_Stream.jpg |
| Background "Toronto skyline" | Night skyline of Toronto, Canada (resized) | Andrew Gosine | CC0 | https://commons.wikimedia.org/wiki/File:Night_skyline_of_Toronto,_Canada_374759.jpg |
| Rain · Film | Raindrops against the window in the night city, Las Palmas (cut to a 16 s loop, re-encoded) | slavikfi | CC0 | https://commons.wikimedia.org/wiki/File:Raindrops_against_the_window_in_the_night_city,_Las_Palmas.webm |

CC BY-SA requires credit and that any adapted version of the image is shared under the same licence. Blurring the photo in the scene counts as an adaptation, so if the app ships with the waterfront background, the credit must name the licence and link to it. The CC0 items need no credit, though it is given on screen anyway.

## Attribution-licensed art (credit required)

Both licences allow commercial use and modification as long as the author is credited. The credit is shown on screen in the scene and listed here.

| Scene | Asset | Author | Licence | Source |
|---|---|---|---|---|
| Underwater Reef | Underwater Fantasy (the four layer PNGs, unmodified) | Luis Zuno (ansimuz) | CC BY 3.0 | https://opengameart.org/content/underwater-fantasy |
| Snowy Summits | Snowy Summits Pixel Art Winter Background (five layer PNGs, unmodified) | CraftPix.net | OGA-BY 3.0 | https://opengameart.org/content/snowy-summits-pixel-art-winter-background |

## NASA footage

| Scene | Asset | Source | Terms |
|---|---|---|---|
| Earth at Night | GOLD Resources: ISS Airglow (`~small` encode, unmodified, 30 s) | https://images.nasa.gov/details/GSFC_20180124_m12825_ISS_Airglow | NASA content is generally not copyrighted and may be used without permission; NASA asks for a credit ("NASA" or "NASA/Goddard") and must not be shown as endorsing the app. See https://www.nasa.gov/nasa-brand-center/images-and-media/ |

## CC0 art (public domain, credit optional)

Files are in `public/assets/scenes/`. Some were resized or converted, which CC0 permits. The original downloads are in `originals/` (gitignored).

| Scene | Asset | Author | Source |
|---|---|---|---|
| Pixel Woods, Campfire | Parallax Forest pack | ansimuz | https://opengameart.org/content/forest-background |
| Campfire | Campfire pixel art animated | ArlanTR | https://opengameart.org/content/campfire-pixel-art-animated |
| Green Ridge | Parallax background forest | MatiasVME | https://opengameart.org/content/parallax-background-forest-pixel-art |
| Cloud Peaks | Background clouds and mountains parallax | FabinhoSC | https://opengameart.org/content/background-clouds-and-mountains-parallax |
| Neon Blocks | City parallax pixel art | Gustavo Saraiva | https://opengameart.org/content/city-parallax-pixel-art |
| Seaview | Background seaview parallax (resized to 1920×1080) | tigitalart | https://opengameart.org/content/background-seaview-parallax |
| City Night | City Night background (resized, JPEG) | andersen | https://opengameart.org/content/city-night-background |
| Night Sky | Background nightsky (resized, JPEG) | tigitalart | https://opengameart.org/content/background-nightsky |
| Forest at Dusk | Animated forest at dusk (GIF converted to WebP) | ShggothSlave | https://opengameart.org/content/animated-forest-at-dusk |

## MIT code and assets

| Scene | Asset | Licence | Source |
|---|---|---|---|
| Open Water | three.js r169: `Water.js`, `Sky.js`, and the `waternormals.jpg` texture | MIT, © three.js authors | https://github.com/mrdoob/three.js |
| Snowfall, Starfield | three.js r169 core (point sprites; the cabin backdrop and sprite textures are drawn in code) | MIT, © three.js authors | https://github.com/mrdoob/three.js |

three.js is bundled into the app at build time (`src/scenes/three-lib.js`), so its MIT notice is kept at `public/THIRD-PARTY-LICENSES.txt`.

## Considered but not included

These Shadertoy shaders are licensed CC BY-NC-SA 3.0. That licence requires credit, non-commercial use only, and releasing any adapted version under the same licence. Shadertoy blocks downloads from our environment. The only copy of Seascape we found (on pastebin) had been altered from the original, so none of the three are included. To use one, take the code from Shadertoy itself and keep it in its own file with the author's licence header.

| Shader | Author | URL | Note |
|---|---|---|---|
| Heartfelt (rain on a fogged window) | BigWings (Martijn Steinrucken) | https://www.shadertoy.com/view/ltffzl | |
| Seascape | TDM (Alexander Alekseev) | https://www.shadertoy.com/view/Ms2SD1 | The author invites requests for other licensing |
| Auroras | nimitz | https://www.shadertoy.com/view/XtGGRt | |

**Not usable:** Inigo Quilez's shaders marked "sole copyright owner" (e.g. Rainforest). Also avoid Pixabay, Mixkit and Coverr footage, because their licences ban standalone or competing-service use.

## Music

The full list of Creative Commons tracks from the Music For Programming mixes is in `src/data/tracks.json`. It has 39 confirmed and 5 likely, each with its licence, episode numbers and source link. Each scene in `src/data/scenes.js` is paired with one of them; `npm run check` verifies the pairing.

### Bundled (in `public/assets/music/`, gitignored)

These are the original files from the netlabel releases on archive.org, unmodified, because most are no-derivatives (ND).

| Track | Artist | Licence | Source |
|---|---|---|---|
| Agreste | Gaston Arevalo | CC BY-NC-ND 3.0 | https://archive.org/details/f_pass009 (FUSELab) |
| Eleemosyn | Maps And Diagrams | CC BY-NC-ND 3.0 DE | https://archive.org/details/YkYk019 (Yuki Yaki) |
| Scali | Vultrapia | CC BY-NC-ND 1.0 | https://archive.org/details/apl008 (Autoplate) |
| Leaves | D_rradio | CC BY-ND 3.0 | https://archive.org/details/sute027 (Sutemos) |
| Calmer | adamned.age | CC BY-NC-ND 3.0 | https://hanneadam.bandcamp.com/album/eiskind (Camomille) |
| Entrance to Golden Suburbia | Bannister Boy | CC BY-NC-ND 2.5 | https://archive.org/details/drift005 (drift) |
| Quiet View | Zen Savauge | CC BY-NC-ND 2.0 | https://www.subsource.de/sub/054 (Subsource) |
| I Was Everything You Wanted Until I Quit | Khonnor | CC BY-NC-ND 1.0 | https://archive.org/details/pls001 (Please Do Something) |

`npm run fetch-music` downloads them from the `stream` URL of each track that has a `file` name in `tracks.json`.

### Streamed

The other playable tracks stream from archive.org, and one from ccMixter. The "Internet Archive live" source picks random CC-licensed releases from the archive.org netlabels collection (ambient, drone, downtempo and IDM). It plays only original MP3s of 185 kbps or more, and shows each track's licence and source link. The archive.org APIs allow requests from any site (CORS `*`), so this works from a local server or an app. The published artifact sandbox blocks it.

Licences for the live tracks come from each item's `licenseurl` field. Uploaders sometimes set this wrongly, so spot-check before featuring a track.
