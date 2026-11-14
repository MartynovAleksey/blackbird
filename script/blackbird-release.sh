#!/usr/bin/env bash
# Собирает blackbird под все платформы и упаковывает как в GitHub-релизах: 6 архивов CLI, desktop и SHA256SUMS.
# Одинаков для обеих линий. Обычно запускается в Docker (script/blackbird-release.Dockerfile).
# usage: script/blackbird-release.sh <версия> [каталог-вывода, по умолчанию ./release]
set -euo pipefail
version=${1:?usage: script/blackbird-release.sh <version> [outdir]}
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "${2:-$root/release}"
out=$(cd "${2:-$root/release}" && pwd)
if [ -f "$root/packages/opencode/script/build.ts" ]; then # 1.x
  pkg=packages/opencode prefix=opencode
else # 2.x
  pkg=packages/cli prefix=cli
fi
# Нативные пакеты всех платформ ставятся одним bun install: точечный install внутри build.ts виснет в контейнере.
(cd "$root" && bun install --frozen-lockfile --os='*' --cpu='*' --libc='*')
(cd "$root/$pkg" && OPENCODE_VERSION=$version OPENCODE_CHANNEL=latest bun run script/build.ts --skip-install)

rm -f "$out"/blackbird-v"$version"-* "$out/SHA256SUMS"
for t in darwin-arm64 darwin-x64 linux-arm64 linux-x64 windows-arm64 windows-x64; do
  bin=$root/$pkg/dist/$prefix-$t/bin
  case $t in
    windows-*) (cd "$bin" && zip -q -9 "$out/blackbird-v$version-$t.zip" blackbird.exe) ;;
    *) tar -czf "$out/blackbird-v$version-$t.tar.gz" -C "$bin" blackbird ;;
  esac
done

# Desktop (2.x): electron-builder собирает macOS только на macOS, поэтому в Linux (Docker) — только linux и windows.
desktop=$root/packages/desktop
if [ -f "$desktop/electron-builder.config.ts" ]; then
  rm -f "$out"/blackbird-desktop-v"$version"-*
  targets="linux-x64 linux-arm64 windows-x64 windows-arm64"
  [ "$(uname)" = Darwin ] && targets="darwin-arm64 darwin-x64 $targets"
  for t in $targets; do
    case $t in darwin-*) kind="--mac zip" ;; windows-*) kind="--win nsis" ;; linux-*) kind="--linux AppImage" ;; esac
    rm -rf "$desktop/dist" "$desktop"/resources/opencode-cli*
    (cd "$desktop" && export OPENCODE_TARGET=$t OPENCODE_CHANNEL=dev CSC_IDENTITY_AUTO_DISCOVERY=false &&
      bun run build &&
      # Без подписи; signAndEditExecutable=false — rcedit для иконки .exe требует wine.
      bunx electron-builder $kind --"${t#*-}" --publish never --config electron-builder.config.ts \
        -c.mac.identity=null -c.win.signAndEditExecutable=false \
        "-c.artifactName=blackbird-desktop-v$version-$t.\${ext}")
    cp "$desktop"/dist/blackbird-desktop-v"$version"-"$t".* "$out"/ && rm -f "$out"/*.blockmap
  done
fi

sum=$(command -v sha256sum || echo "shasum -a 256")
(cd "$out" && $sum blackbird-*v"$version"-* >SHA256SUMS)
ls -l "$out"
