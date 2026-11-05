#!/bin/bash
# Build per-browser deliverable zips, split versions.
# Usage: ./build.sh [chrome|firefox|all]  (default: all)
# Chrome version comes from manifest.json, Firefox from manifest.firefox.json.
# The two versions are independent now: Chrome is 2.x (GPU speed line),
# Firefox stays 1.4.x (needed patches only). No combined zip is produced;
# each browser zip is standalone, with its manifest at the zip root.
# Each built copy's src/shared/version.js BUILD is set to that browser's
# manifest version, so the popup/options footer and the page-cache key
# match the manifest for that browser. The source tree's version.js
# follows the Chrome manifest (the repo root manifest is Chrome's).
set -euo pipefail
MODE="${1:-all}"
case "$MODE" in
  chrome|firefox|all) ;;
  *) echo "Usage: ./build.sh [chrome|firefox|all]"; exit 1 ;;
esac
SRC="$(cd "$(dirname "$0")" && pwd)"
CHROME_VERSION="$(python3 -c "import json;print(json.load(open('$SRC/manifest.json'))['version'])")"
FIREFOX_VERSION="$(python3 -c "import json;print(json.load(open('$SRC/manifest.firefox.json'))['version'])")"
DIST="$SRC/dist"
LOCAL_DIR="$HOME/workspace/your_files"

rm -rf "$DIST"
mkdir -p "$DIST"

# Locale parity (source tree, once): all 17 _locales must have identical key sets. Fail on drift.
python3 - <<'EOF'
import json, glob, sys
locales = sorted(glob.glob('_locales/*/messages.json'))
assert len(locales) == 17, f'expected 17 locales, found {len(locales)}'
base = set(json.load(open(locales[0])).keys())
ok = True
for loc in locales[1:]:
    keys = set(json.load(open(loc)).keys())
    missing = base - keys
    extra = keys - base
    if missing or extra:
        ok = False
        print(f'DRIFT {loc}: missing={sorted(missing)[:5]} extra={sorted(extra)[:5]}')
if not ok:
    sys.exit(1)
print(f'locales OK: 17 locales, {len(base)} keys each')
EOF

build_one() {
  local browser="$1" version="$2"
  local outdir="$DIST/$browser"
  mkdir -p "$outdir"
  if [ "$browser" = "chrome" ]; then
    rsync -a --exclude 'node_modules' --exclude 'dist' --exclude '*.zip' \
      --exclude '.DS_Store' --exclude 'build.sh' --exclude 'manifest.firefox.json' --exclude '.git' \
      --exclude 'hidden-audit' --exclude 'package.json' --exclude 'package-lock.json' \
      "$SRC/" "$outdir/"
  else
    rsync -a --exclude 'node_modules' --exclude 'dist' --exclude '*.zip' \
      --exclude '.DS_Store' --exclude 'build.sh' --exclude 'manifest.json' --exclude 'manifest.firefox.json' --exclude '.git' \
      --exclude 'hidden-audit' --exclude 'package.json' --exclude 'package-lock.json' \
      "$SRC/" "$outdir/"
    cp "$SRC/manifest.firefox.json" "$outdir/manifest.json"
  fi
  # BUILD in this copy = this browser's manifest version (footer + cache key).
  sed -i "s/const BUILD = '[^']*'/const BUILD = '$version'/" "$outdir/src/shared/version.js"
  python3 - <<EOF
import json
m = json.load(open('$outdir/manifest.json'))
assert m['version'] == '$version', (m['version'], '$version')
build = open('$outdir/src/shared/version.js').read()
assert "const BUILD = '$version'" in build, 'BUILD mismatch in $browser copy'
if '$browser' == 'chrome':
    assert m['background']['service_worker'] == 'src/background/service-worker.js'
    assert 'offscreen' in m['permissions'] and 'alarms' in m['permissions']
else:
    assert m['background']['page'] == 'src/background/background.html'
    assert 'offscreen' not in m['permissions']
    assert m['browser_specific_settings']['gecko']['id']
print('manifest OK ($browser):', m['version'])
EOF
  for f in src/background/ml-bridge.js src/background/background.html src/background/background-ff.js src/shared/pixel-bus.js; do
    test -f "$outdir/$f" || { echo "MISSING $browser/$f"; exit 1; }
  done
  for f in src/background/service-worker.js src/background/translators.js src/background/ml-bridge.js src/background/ml-worker.js src/content/content.js src/ui/options.js src/ui/popup.js src/offscreen/offscreen.js src/offscreen/offscreen-progress.js src/shared/page-cache.js; do
    node --check "$outdir/$f" >/dev/null || { echo "SYNTAX FAIL $browser/$f"; exit 1; }
  done
  echo "files OK ($browser)"
  local zipname="comic-translate-4-free-v${version}-${browser}.zip"
  (cd "$outdir" && zip -qr "$DIST/$zipname" .)
  echo "wrote $DIST/$zipname ($(du -h "$DIST/$zipname" | cut -f1))"
  mkdir -p "$LOCAL_DIR"
  cp "$DIST/$zipname" "$LOCAL_DIR/"
  echo "copied to $LOCAL_DIR/$zipname"
}

if [ "$MODE" = "chrome" ] || [ "$MODE" = "all" ]; then
  build_one chrome "$CHROME_VERSION"
fi
if [ "$MODE" = "firefox" ] || [ "$MODE" = "all" ]; then
  build_one firefox "$FIREFOX_VERSION"
fi
echo "done: chrome $CHROME_VERSION, firefox $FIREFOX_VERSION (built: $MODE)"
