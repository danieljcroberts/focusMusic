#!/bin/sh
# Build the site and push dist/ to the gh-pages branch, which GitHub Pages serves when the repository's
# Pages source is set to "Deploy from a branch" (gh-pages, root). Needs the bundled music fetched first
# (npm run fetch-music), since dist/ carries a copy of public/.
#   scripts/deploy-pages.sh            build, then publish
#   scripts/deploy-pages.sh --no-build publish the existing dist/
# Each deploy replaces gh-pages with a single fresh commit (force-pushed): the branch is only build output, and keeping
# its history would pile up a copy of the Android APK for every release. The APK and its app-version.json, published by
# scripts/release.sh, are carried over from the live site when dist/ doesn't have them, so a web-only deploy keeps them.
set -e
cd "$(dirname "$0")/.."
[ "$1" = "--no-build" ] || { npm run lint && npm run check && npm run build; }
[ -f dist/index.html ] || { echo "dist/index.html is missing; run npm run build" >&2; exit 1; }

work=$(mktemp -d); keep=$(mktemp -d); tmp=gh-pages-deploy-$$
cleanup() { git worktree remove --force "$work" 2>/dev/null || rm -rf "$work"; git branch -D -q "$tmp" 2>/dev/null || true; rm -rf "$keep"; }
trap cleanup EXIT
live=""
if git fetch -q origin gh-pages 2>/dev/null; then
  live=$(git rev-parse FETCH_HEAD)
  for f in slow-windows-debug.apk app-version.json; do
    if [ ! -f "dist/$f" ] && git cat-file -e "$live:$f" 2>/dev/null; then git show "$live:$f" > "$keep/$f"; fi
  done
fi
git worktree add -q --detach "$work"
git -C "$work" checkout -q --orphan "$tmp"
git -C "$work" rm -rq --cached . 2>/dev/null || true
find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
# Hard links where the file system allows (no second copy of the site on disk), a plain copy otherwise.
cp -al dist/. "$work"/ 2>/dev/null || cp -R dist/. "$work"/
cp -R "$keep"/. "$work"/
touch "$work/.nojekyll"   # serve files as they are, no Jekyll pass
git -C "$work" add -A
if [ -n "$live" ] && [ "$(git -C "$work" write-tree)" = "$(git rev-parse "$live^{tree}")" ]; then echo "gh-pages is already up to date"; exit 0; fi
git -C "$work" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "Deploy $(git rev-parse --short HEAD)"
git -C "$work" push -q -f origin "HEAD:gh-pages"
# Old deploys are unreachable once replaced; drop them so copies of the APK do not pile up in .git.
git reflog expire --expire=now --all 2>/dev/null; git gc --prune=now -q 2>/dev/null || true
echo "Deployed $(git rev-parse --short HEAD) to gh-pages. Pages source: Settings > Pages > Deploy from a branch > gh-pages / (root)."
