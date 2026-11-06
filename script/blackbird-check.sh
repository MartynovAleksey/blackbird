#!/usr/bin/env bash
# Проверка ребрендинга blackbird: openspec/changes/blackbird-fork/specs/{runtime-branding,provider-config}.
# Собирает CLI, гоняет его в пустом HOME и падает на любом пути с "opencode", встроенном провайдере
# или запросе каталога моделей. Одинаков для обеих линий.
# usage: script/blackbird-check.sh [--no-build]
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
if [ -f "$root/packages/opencode/script/build.ts" ]; then # 1.x
  pkg=packages/opencode standalone=
else # 2.x
  pkg=packages/cli standalone=--standalone
fi
[ "${1:-}" = --no-build ] || (cd "$root/$pkg" && bun run script/build.ts --single --skip-install --skip-web-ui)
bin=$(find "$root/$pkg/dist" -path '*/bin/*' -type f -name blackbird 2>/dev/null | head -1)
[ -n "$bin" ] || { echo "FAIL: бинарник blackbird не собран в $pkg/dist" >&2; exit 1; }

t=$(mktemp -d)
mkdir -p "$t/h" "$t/t" "$t/p" "$t/cfg"
status=0
fail() { echo "FAIL: $*" >&2; status=1; }

# Заглушка для каталога моделей и провайдера из конфига: всё, что не /v1/*, — запрос каталога.
python3 -c '
import http.server, sys
log = open(sys.argv[1], "a", buffering=1)
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(s): log.write(s.path + "\n"); s.send_response(404); s.end_headers()
    do_POST = do_GET
    def log_message(s, *a): pass
srv = http.server.HTTPServer(("127.0.0.1", 0), H)
print(srv.server_port, flush=True)
srv.serve_forever()
' "$t/hits" >"$t/port" &
stub=$!
disown "$stub"
bb() {
  env -i PATH="$PATH" HOME="$t/h" TMPDIR="$t/t" TERM=dumb \
    BLACKBIRD_MODELS_URL="http://127.0.0.1:$port" BLACKBIRD_CONFIG_DIR="$t/cfg" "$@"
}
cleanup() {
  bb "$bin" service stop >/dev/null 2>&1 || true
  kill "$stub" 2>/dev/null || true
  rm -rf "$t"
}
trap cleanup EXIT
until [ -s "$t/port" ]; do sleep 0.1; done
port=$(cat "$t/port")

cat >"$t/cfg/blackbird.json" <<EOF
{"provider":{"bbcheck":{"npm":"@ai-sdk/openai-compatible","name":"bbcheck",
  "options":{"baseURL":"http://127.0.0.1:$port/v1","apiKey":"x"},"models":{"m1":{"name":"m1"}}}}}
EOF
git -C "$t/p" init -q

bb "$bin" --version >/dev/null || fail "--version"
help=$(bb "$bin" --help 2>&1 || true)
grep -qi blackbird <<<"$help" || fail "--help не упоминает blackbird"
grep -qi opencode <<<"$help" && fail "--help упоминает opencode"

models=$(cd "$t/p" && bb OPENAI_API_KEY=sk-check ANTHROPIC_API_KEY=sk-check "$bin" models $standalone 2>/dev/null || true)
[ "$models" = bbcheck/m1 ] || fail "ожидался только bbcheck/m1 из BLACKBIRD_CONFIG_DIR/blackbird.json, получено: $(head -5 <<<"$models" | tr '\n' ' ')"

(cd "$t/p" && bb perl -e 'alarm 90; exec @ARGV' "$bin" run $standalone ping >/dev/null 2>&1) || true
bb "$bin" service stop >/dev/null 2>&1 || true

found=$(find "$t" -iname '*opencode*' -not -path "$t/p/.git/*" | sed "s|^$t||")
[ -z "$found" ] || fail "пути с opencode:"$'\n'"$found"
catalog=$(grep -v '^/v1/' "$t/hits" 2>/dev/null || true)
[ -z "$catalog" ] || fail "запросы каталога моделей: $(tr '\n' ' ' <<<"$catalog")"

[ $status = 0 ] && echo "OK: $bin"
exit $status
