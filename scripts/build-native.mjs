// Builds the web app for the Android app (vite --mode native into dist-native) and copies it into the Android project.
// The bundled music (about 250 MB) is left out of the app, which would otherwise pass Google Play's 200 MB limit:
// the native build streams those tracks from the live site instead (see M in src/assets.js). Scene art stays in.
// Usage: node scripts/build-native.mjs   then build the APK with: cd android && ./gradlew assembleDebug
import { execSync } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';

const run = c => execSync(c, { stdio: 'inherit' });
run('npx vite build --mode native --outDir dist-native --emptyOutDir');
for (const p of ['dist-native/assets/music', 'dist-native/sw.js']) if (existsSync(p)) rmSync(p, { recursive: true, force: true });
run('npx cap sync android');
