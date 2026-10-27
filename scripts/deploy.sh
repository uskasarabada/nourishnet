#!/usr/bin/env bash
# Builds the site and publishes it to the gh-pages branch (served by GitHub Pages).
# Usage: npm run deploy
set -euo pipefail
cd "$(dirname "$0")/.."

npm test
VITE_BASE=/nourishnet/ npm run build
# Single-page app: serve index.html for unknown paths so direct links work.
cp dist/index.html dist/404.html
touch dist/.nojekyll

REMOTE=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q --force "$REMOTE" gh-pages
rm -rf .git
echo "Deployed to https://uskasarabada.github.io/nourishnet/"
