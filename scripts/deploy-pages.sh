#!/bin/sh
# Build the site and push dist/ to the gh-pages branch, which GitHub Pages serves when the repository's
# Pages source is set to "Deploy from a branch" (gh-pages, root). Needs the bundled music fetched first
# (npm run fetch-music), since dist/ carries a copy of public/.
#   scripts/deploy-pages.sh            build, then publish
#   scripts/deploy-pages.sh --no-build publish the existing dist/
set -e
cd "$(dirname "$0")/.."
[ "$1" = "--no-build" ] || { npm run lint && npm run check && npm run build; }
[ -f dist/index.html ] || { echo "dist/index.html is missing; run npm run build" >&2; exit 1; }

work=$(mktemp -d)
trap 'git worktree remove --force "$work" 2>/dev/null || rm -rf "$work"' EXIT
if git show-ref --quiet refs/remotes/origin/gh-pages; then
  git fetch -q origin gh-pages
  git worktree add -q "$work" origin/gh-pages
  git -C "$work" checkout -q -B gh-pages
else
  git worktree add -q --detach "$work"
  git -C "$work" checkout -q --orphan gh-pages
  git -C "$work" rm -rq --cached . 2>/dev/null || true
fi
find "$work" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/. "$work"/
touch "$work/.nojekyll"   # serve files as they are, no Jekyll pass
git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then echo "gh-pages is already up to date"; exit 0; fi
git -C "$work" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" commit -q -m "Deploy $(git rev-parse --short HEAD)"
git -C "$work" push -q origin gh-pages
echo "Deployed $(git rev-parse --short HEAD) to gh-pages. Pages source: Settings > Pages > Deploy from a branch > gh-pages / (root)."
