# Google Play listing: Slow Windows

Everything the Play Console asks for, ready to paste. Pictures are beside this file (`phone-*.jpg` at 1080×1920, `feature-graphic.png` at 1024×500); the 512×512 icon is `public/icon-512.png`. Regenerate the pictures with `node scripts/store-art.mjs`.

## App details

- **App name** (30): Slow Windows
- **Category**: Music & Audio
- **Tags**: Focus, Relaxation, Ambient, Sleep
- **Contact email**: your choice (Play shows it publicly)
- **Privacy policy**: https://danieljcroberts.github.io/focusMusic/privacy.html
- **Price**: Free. No ads, no in-app purchases.

## Short description (80)

Calm living scenes, free Creative Commons music and a focus timer. No ads.

## Full description (4000)

Slow Windows is a quiet place to work, rest and fall asleep: 110 living scenes, Creative Commons music, ambient sound and a focus timer, free and without ads, accounts or tracking.

SCENES THAT FOLLOW YOUR WORLD
• Rain on glass, a fjord under the aurora, a harbour at dawn, a tent in the rain, a koi pond, a library window and many more, most drawn live in code.
• They follow your clock from dawn to dusk to night, change with the seasons, show tonight's real moon, and with your location bring rain or snow when it is really falling.
• The aurora scenes brighten when the real aurora forecast is strong.

MUSIC
• Around eleven hours of hand-picked Creative Commons music: ambient, downtempo, lo-fi, post-rock, modern classical, synthwave and more, every track credited.
• Soundtracks by genre, a Loved list, and your own music, which stays on your phone.
• Keeps playing with the screen off, with controls on the lock screen and your headphones.
• Download the music for listening without a connection.

FOCUS AND SLEEP
• A focus timer with breaks, intentions and a weekly look-back.
• A sunrise alarm: the scene brightens and the music fades up over ten minutes, even if the app was closed.
• Bedtime in one tap: calm music, a dark scene and a sleep timer that slows and dims everything as it winds down.
• Listen only: a dark screen with a clock, for nights and long sessions.

YOURS
• Choose which scenes to include, keep favourites, add your own photos as scenes, mix in rain, sea, fire, brown noise and more.
• Save any scene as a picture.
• Quick Settings tiles for Focus and Bedtime, a home-screen widget with today's focus minutes, and picture-in-picture.
• Set any scene as your wallpaper, refreshed each morning so it follows the season and the weather.

Free forever. No ads, no accounts, no tracking: everything you set up stays on your device.

## Content rating questionnaire

No violence, sexual content, profanity, drugs, gambling or user-generated content shared with others. No in-app purchases. Expect **Everyone / PEGI 3**.

## Data safety form

- Does the app collect or share user data? **No.**
- Location: if asked, the approximate location is used only on the device and sent to a weather service only to fetch the forecast, not stored or linked to the user. Under Play's definitions this is not "collected" (processed only transiently, for the user's request). If in doubt, declare *Approximate location*, purpose *App functionality*, not shared, optional.
- Data encrypted in transit: **Yes** (all requests are HTTPS).
- Can users request data deletion? Nothing is held off the device; uninstalling removes everything.

## Permission declarations

- **Foreground service, media playback**: "Plays music and ambient sound chosen by the user, which continues with the screen off; the ongoing notification shows the track with playback controls."
- **USE_EXACT_ALARM / full-screen intent**: "The app's sunrise alarm wakes the user at a time they set: at that time it opens the app over the lock screen to start the alarm (a brightening scene and music). This is a core, user-facing alarm feature." If Play questions USE_EXACT_ALARM, the alternative is SCHEDULE_EXACT_ALARM, which the user grants in settings.
- **Notifications**: playback controls and focus-timer notices.

## Releasing

1. `npm run bundle` builds `android/app/build/outputs/bundle/release/app-release.aab`, signed with the upload key in `~/.android-keys/` (back that folder up; never commit it).
2. In the Play Console, create the app, turn on Play App Signing, and upload the bundle to **Closed testing** first: new personal accounts need 12 testers for 14 days before production.
3. Raise `versionCode` for each upload (`npm run release` does this for the sideloaded APK too).
