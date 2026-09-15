#!/usr/bin/env bash
# Reproducible benchmark + acceptance checks. Usage: BASE=http://localhost:8080 bash deploy/benchmark.sh
set -u
BASE="${BASE:-http://localhost:8080}"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

check() { # check <desc> <url> <expected_status> [header_substr]
  local desc="$1" url="$2" want="$3" h="${4:-}"
  code=$(curl -s -o /dev/null -w '%{http_code}' "$url")
  [ "$code" = "$want" ] && ok "$desc -> $code" || bad "$desc -> $code (want $want)"
}

echo "== acceptance =="
check "flag webp"            "$BASE/api/flags/bd?size=320&format=webp" 200
check "canonical immutable"  "$BASE/assets/v1/images/w320/bd.png" 200
check "countries list"       "$BASE/api/v1/countries" 200
check "country iso3"         "$BASE/api/v1/countries/BGD" 200
check "country numeric"      "$BASE/api/v1/countries/050" 200
check "gb-eng"               "$BASE/api/v1/countries/gb-eng" 200
check "manifest"             "$BASE/api/v1/countries/bd/assets" 200
check "global manifest"      "$BASE/api/v1/assets" 200
check "healthz"              "$BASE/healthz" 200
check "readyz"               "$BASE/readyz" 200
check "bad code 404"         "$BASE/api/flags/xx?size=320" 404
check "bad format 400"       "$BASE/api/flags/bd?format=bmp" 400
check "traversal blocked"    "$BASE/assets/v1/..%2f..%2fgo.mod" 404

echo "== headers =="
ct=$(curl -s -o /dev/null -D - "$BASE/api/flags/bd?size=320&format=webp" | tr -d '\r' | grep -i '^content-type:' | head -1)
echo "$ct" | grep -qi 'image/webp' && ok "webp content-type" || bad "webp content-type ($ct)"
ce=$(curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' "$BASE/api/flags/bd?size=320&format=png" | tr -d '\r' | grep -i '^content-encoding:' | head -1 || true)
[ -z "$ce" ] && ok "png never compressed" || bad "png compressed ($ce)"
ce2=$(curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' "$BASE/api/v1/countries" | tr -d '\r' | grep -i '^content-encoding:' | head -1 || true)
echo "$ce2" | grep -qi 'gzip' && ok "json precomputed gzip" || bad "json gzip ($ce2)"
code304=$(curl -s -o /dev/null -w '%{http_code}' -H "$(curl -s -D - -o /dev/null "$BASE/api/flags/bd?size=320&format=webp" | tr -d '\r' | grep -i '^etag:' | head -1 | sed 's/^[^:]*: *//;s/^/If-None-Match: /')" "$BASE/api/flags/bd?size=320&format=webp")
[ "$code304" = "304" ] && ok "304 revalidation" || bad "304 revalidation ($code304)"

echo "== load (wrk if present, else curl timing) =="
if command -v wrk >/dev/null; then
  wrk -t4 -c100 -d10s "$BASE/api/v1/countries" | tail -8
  wrk -t4 -c100 -d10s "$BASE/api/flags/bd?size=320&format=webp" | tail -8
else
  echo "(wrk not installed; timing 200 sequential requests)"
  start=$(date +%s%N)
  for _ in $(seq 1 200); do curl -s -o /dev/null "$BASE/api/v1/countries"; done
  end=$(date +%s%N)
  echo "countries 200x: $(( (end - start) / 1000000 )) ms total"
  start=$(date +%s%N)
  for _ in $(seq 1 200); do curl -s -o /dev/null "$BASE/api/flags/bd?size=320&format=webp"; done
  end=$(date +%s%N)
  echo "flag 200x: $(( (end - start) / 1000000 )) ms total"
fi

echo
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
