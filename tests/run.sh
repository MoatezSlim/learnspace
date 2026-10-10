#!/usr/bin/env bash
# Runs every check: TypeScript, the demo-history unit test, then the browser tests against the
# local build served on http://localhost:4173.
# Needs Node 18+, Python 3 and Playwright for Python:
#   pip install playwright && python3 -m playwright install chromium
set -uo pipefail
cd "$(dirname "$0")/.."
OUT=tests/.out
mkdir -p "$OUT"
fail=0

echo "== typecheck"
npx tsc --noEmit || fail=1

echo "== build"
node build.mjs || exit 1

echo "== unit: demo history"
npx esbuild tests/unit/demo.test.ts --bundle --platform=node --format=cjs --outfile="$OUT/demo.test.cjs" --log-level=warning || exit 1
node "$OUT/demo.test.cjs" | grep -E '^(PASS|FAIL)' | tee "$OUT/unit.log"
grep -q '^FAIL' "$OUT/unit.log" && fail=1

npx esbuild tests/e2e/gen-states.ts --bundle --platform=node --format=cjs --outfile="$OUT/gen-states.cjs" --log-level=warning || exit 1
node "$OUT/gen-states.cjs" "$OUT"

python3 -m http.server 4173 --bind 127.0.0.1 -d dist-local >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
for _ in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:4173/ && break; sleep 0.2; done

for t in tests/e2e/test_*.py; do
  name=$(basename "$t" .py)
  echo "== e2e: $name"
  python3 "$t" "$OUT" > "$OUT/$name.log" 2>&1 || fail=1
  grep -E '^(PASS|FAIL)' "$OUT/$name.log"
  grep -q '^FAIL' "$OUT/$name.log" && fail=1
  grep -q '^PASS' "$OUT/$name.log" || { echo "FAIL $name produced no results (see $OUT/$name.log)"; fail=1; }
done

echo
if [ "$fail" -eq 0 ]; then
  echo "All checks passed: $(cat "$OUT"/*.log | grep -c '^PASS') results."
else
  echo "Some checks failed. Logs and screenshots: $OUT/"
fi
exit $fail
