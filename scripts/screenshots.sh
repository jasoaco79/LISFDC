#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/screenshots"
mkdir -p "$OUT"
CHROME="${CHROME_PATH:-google-chrome}"
PROFILE="${ROOT}/.tmp-chrome-screenshots"
mkdir -p "$PROFILE"

shot() {
  local name="$1"
  local file="$2"
  local width="$3"
  local height="$4"
  # file:// + static HTML (no JS). timeout(1) kills Chrome if it hangs on GCM.
  timeout 20s "$CHROME" \
    --headless=new \
    --user-data-dir="${PROFILE}" \
    --no-first-run \
    --disable-gpu \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-background-networking \
    --disable-sync \
    --disable-extensions \
    --disable-default-apps \
    --hide-scrollbars \
    --window-size="${width},${height}" \
    --screenshot="$OUT/${name}" \
    "file://${file}" \
    >/tmp/lisfdc-chrome-shot.log 2>&1 || true
  if [[ ! -s "$OUT/${name}" ]]; then
    echo "failed to write $OUT/${name}" >&2
    cat /tmp/lisfdc-chrome-shot.log >&2 || true
    exit 1
  fi
  echo "wrote $OUT/${name} ($(wc -c < "$OUT/${name}") bytes)"
}

shot "side-panel-compare.png" "$ROOT/fixtures/panel-compare.html" 880 980
shot "side-panel-narrow.png" "$ROOT/fixtures/panel-compare.html" 420 1100
shot "side-panel-empty.png" "$ROOT/fixtures/panel-empty.html" 880 780
shot "side-panel-unsigned.png" "$ROOT/fixtures/panel-unsigned.html" 880 820
