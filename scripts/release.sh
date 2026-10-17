#!/bin/sh
# One release of both apps: the web app and the Android app, from the committed code.
#   npm run release -- "What changed, in a line"    (the note is shown in the Android app's update notice)
# It checks the code, raises the Android version by one, builds the web app and the APK, commits and pushes the
# version change, and publishes both to GitHub Pages: the APK at slow-windows-debug.apk beside app-version.json, which
# the Android app reads to offer the update. Needs Java 21 and the Android SDK (defaults: ~/.local/jdk, ~/android-sdk).
set -e
cd "$(dirname "$0")/.."
notes="$1"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk}" ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
[ -z "$(git status --porcelain)" ] || { echo "Commit or stash your changes first: a release is built from committed code." >&2; exit 1; }

npm run lint
npm run check

# The new version: the Android versionCode goes up by one, and the name follows it.
gradle=android/app/build.gradle
code=$(( $(sed -n 's/^ *versionCode \([0-9]*\).*/\1/p' "$gradle") + 1 ))
name="1.0.$code"
sed -i "s/^\( *versionCode \)[0-9]*/\1$code/; s/^\( *versionName \)\"[^\"]*\"/\1\"$name\"/" "$gradle"
echo "Releasing $name (versionCode $code)"

npm run build
node scripts/build-native.mjs
(cd android && ./gradlew assembleDebug --no-daemon -q)
cp android/app/build/outputs/apk/debug/app-debug.apk dist/slow-windows-debug.apk
CODE="$code" NAME="$name" NOTES="$notes" node -e '
  const { writeFileSync } = require("fs");
  writeFileSync("dist/app-version.json", JSON.stringify({ code: +process.env.CODE, name: process.env.NAME, apk: "slow-windows-debug.apk", notes: process.env.NOTES || "", at: new Date().toISOString() }, null, 1) + "\n");'

git add "$gradle"
git commit -q -m "Release $name${notes:+: $notes}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
scripts/deploy-pages.sh --no-build

# The Android build output is large and rebuilt every time; clear it to keep the disk free.
rm -rf android/app/build android/build android/capacitor-cordova-android-plugins/build node_modules/@capacitor/*/android/build node_modules/@capacitor/android/capacitor/build
echo "Released $name. Phones with the app will offer the update next time it opens; the APK is at https://danieljcroberts.github.io/focusMusic/slow-windows-debug.apk"
