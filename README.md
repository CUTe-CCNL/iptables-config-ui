# iptables Config UI

A temporary web UI for editing live IPv4 `iptables` rules. The React/Vite UI is embedded into a single Go binary.

## Development

```bash
pnpm install --store-dir /tmp/iptables-config-ui-pnpm-store
pnpm build
go test ./...
go build -buildvcs=false -o iptables-config-ui .
./iptables-config-ui --mock
```

Open the URL printed by the server. It includes a one-time `?token=...` value for write actions.

## Live Usage

Build a static Linux binary:

```bash
pnpm build
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -buildvcs=false -trimpath -tags "netgo osusergo" -ldflags "-s -w" -o dist/iptables-config-ui-linux-amd64 .
```

Or use the packaged script:

```bash
pnpm run build:static
```

Run it on the target host:

```bash
sudo ./iptables-config-ui-linux-amd64
```

The service binds to `0.0.0.0:8921` by default, generates a one-time session token, and keeps rollback state only in memory while the process is alive.

Use `--addr 127.0.0.1:8921` if you want local-only access.

This tool does not persist firewall rules across reboot. It edits live `iptables` state only.

## Alpine Notes

Use the static build above for Alpine. A normal Go build can link against glibc on the build machine, which fails on Alpine because Alpine uses musl.

The binary embeds the web UI and Go runtime dependencies, but the host still needs the `iptables` userspace tools because the service applies rules through `iptables-save` and `iptables-restore`:

```bash
apk add iptables
```
