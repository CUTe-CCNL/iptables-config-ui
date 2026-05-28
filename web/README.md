# iptables Config UI Web

React/Vite frontend for the embedded iptables configuration tool. The UI is built with shadcn/ui components and talks to the Go API under `/api`.

## API Wiring

- `GET /api/system` loads host, mode, command, and capability status.
- `GET /api/rules` loads the live ruleset snapshot into an editable draft.
- `POST /api/validate` validates the draft before apply.
- `POST /api/apply` applies the draft with the current snapshot ID.
- `POST /api/rollback` restores the previous in-memory snapshot.
- `POST /api/shutdown` asks the local server to exit.

Mutating endpoints require `X-Session-Token`. Open the URL printed by the Go server with `?token=...`, or paste the token in the Overview tab.

## Development

```bash
pnpm install
pnpm run dev
```

The Vite dev server proxies `/api` to `http://127.0.0.1:8921`.

For an end-to-end local run:

```bash
pnpm run build
cd ..
GOCACHE=/tmp/iptables-config-ui-go-cache go run . --mock --addr 127.0.0.1:8921
```
