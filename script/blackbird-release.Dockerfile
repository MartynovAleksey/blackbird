# Образ-сборщик релизов blackbird: только инструменты, исходники монтируются при запуске.
#   docker build --platform linux/arm64 -t blackbird-builder - < script/blackbird-release.Dockerfile
#   docker run --rm --platform linux/arm64 -e VERSION=<версия> -v "$PWD":/src:ro -v "$PWD/release":/out \
#     -v blackbird-bun-cache:/cache blackbird-builder
# --platform linux/arm64 — нативно на Apple Silicon (под Rosetta amd64 bun install виснет); целевые платформы
# от этого не зависят, все шесть собираются кросс-компиляцией.
# Сборка идёт в копии /work: bun install в /src заменил бы node_modules хоста на линуксовые.
FROM oven/bun:1.4.4
# python3, make и g++ — для нативных модулей (tree-sitter-*), которые bun install собирает из исходников.
RUN apt-get update && apt-get install -y --no-install-recommends zip rsync python3 make g++ && rm -rf /var/lib/apt/lists/*
ENV BUN_INSTALL_CACHE_DIR=/cache
WORKDIR /work
ENTRYPOINT ["sh", "-euc", "test -n \"${VERSION:-}\" || { echo 'нужен -e VERSION=<версия>' >&2; exit 1; }; rsync -a --delete --exclude node_modules --exclude dist --exclude .git --exclude release /src/ /work/; script/blackbird-release.sh \"$VERSION\" /out"]
