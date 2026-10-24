// Builds the web app for the Android app (vite --mode native into dist-native) and copies it into the Android project.
// The bundled music (about 250 MB) is left out of the app, which would otherwise pass Google Play's 200 MB limit:
// the native build streams those tracks from the live site instead (see M in src/assets.js). Scene art stays in.
// The music folder is moved aside while Vite copies public/ (a rename on the same disk, so nothing is copied), and
// always put back, even if the build fails; a run interrupted half way is put right at the start of the next one.
// Usage: node scripts/build-native.mjs   then build the APK with: cd android && ./gradlew assembleDebug
import { execSync } from 'node:child_process';
import { rmSync, existsSync, renameSync } from 'node:fs';

const MUSIC = 'public/assets/music', ASIDE = '.music-aside';
const restore = () => { if (existsSync(ASIDE) && !existsSync(MUSIC)) renameSync(ASIDE, MUSIC); };
const run = c => execSync(c, { stdio: 'inherit' });
restore();
if (existsSync(MUSIC)) renameSync(MUSIC, ASIDE);
try { run('npx vite build --mode native --outDir dist-native --emptyOutDir'); } finally { restore(); }
for (const p of ['dist-native/assets/music', 'dist-native/sw.js']) if (existsSync(p)) rmSync(p, { recursive: true, force: true });
run('npx cap sync android');
