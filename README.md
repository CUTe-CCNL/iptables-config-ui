# iptables Config UI

iptables Config UI is a small web tool for inspecting and editing live IPv4
`iptables` rules. It serves a React/Vite interface from a single Go binary and
applies changes through the host's `iptables-save` and `iptables-restore`
commands.

## What it does

- Loads the current live rules into an editable draft.
- Supports structured `filter` rules, NAT port forwards, and NAT masquerade
  rules.
- Preserves unsupported rules as raw read-only lines when possible.
- Validates drafts before applying them.
- Protects apply with a snapshot ID so stale drafts do not overwrite newer live
  rules.
- Keeps one in-memory rollback snapshot after a successful apply.
- Provides `--mock` mode for local development without touching host firewall
  state.

## Requirements

- Go.
- pnpm.
- A Linux target host with `iptables`, `iptables-save`, and
  `iptables-restore`.
- Root privileges for live mode. Use `sudo` when running against real firewall
  state.

## Quick start

Build the web UI, run tests, build the Go binary, then start in mock mode:

```bash
pnpm --dir web install
pnpm --dir web run build
go test ./...
go build -buildvcs=false -o iptables-config-ui .
./iptables-config-ui --mock --addr 127.0.0.1:8921
```

Open the URL printed by the server. It includes a one-time `?token=...` query
value used for write actions.

## Live usage

Build a static Linux binary:

```bash
./scripts/build-static-linux.sh
```

Run it on the target host:

```bash
sudo ./dist/iptables-config-ui-linux-amd64
```

The service binds to `0.0.0.0:8921` by default and prints access URLs with the
session token. Bind to localhost if you do not want network access:

```bash
sudo ./dist/iptables-config-ui-linux-amd64 --addr 127.0.0.1:8921
```

Available flags:

- `--addr`: HTTP listen address. Defaults to `0.0.0.0:8921`.
- `--mock`: use an in-memory firewall backend for development.

## Safety notes

- Mutating API calls require the generated `X-Session-Token`.
- The tool edits live `iptables` state only; it does not persist rules across
  reboot.
- Rollback state is kept only in memory and is lost when the process exits.
- Apply fails if live rules changed after the draft was loaded.
- Unsupported rules are preserved as raw/read-only entries where possible, but
  only supported structured rules can be edited in the UI.

## Development

Run the frontend dev server:

```bash
pnpm --dir web run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8921`. In another
terminal, run the Go server in mock mode:

```bash
pnpm --dir web run build
go run . --mock --addr 127.0.0.1:8921
```

## Alpine and static builds

Use `./scripts/build-static-linux.sh` for Alpine or other minimal Linux targets.
A normal Go build can depend on the build machine's libc, while the script
builds with `CGO_ENABLED=0`.

The binary embeds the web UI and Go runtime dependencies, but the target host
still needs the `iptables` userspace tools:

```bash
apk add iptables
```
