#!/usr/bin/env sh
set -eu

GOOS="${GOOS:-linux}"
GOARCH="${GOARCH:-amd64}"
OUT="${OUT:-dist/iptables-config-ui-${GOOS}-${GOARCH}}"
GOCACHE="${GOCACHE:-/tmp/iptables-config-ui-go-cache}"

pnpm build
mkdir -p "$(dirname "$OUT")"
mkdir -p "$GOCACHE"

CGO_ENABLED=0 GOCACHE="$GOCACHE" GOOS="$GOOS" GOARCH="$GOARCH" go build \
  -buildvcs=false \
  -trimpath \
  -tags "netgo osusergo" \
  -ldflags "-s -w" \
  -o "$OUT" \
  .

echo "built $OUT"
