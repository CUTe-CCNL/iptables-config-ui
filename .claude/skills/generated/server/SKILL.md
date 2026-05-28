---
name: server
description: "Skill for the Server area of iptables-config-ui. 25 symbols across 4 files."
---

# Server

25 symbols | 4 files | Cohesion: 83%

## When to Use

- Working with code in `internal/`
- Understanding how NewMockRunner, TestMutatingEndpointsRequireToken, TestMockModeReturnsRules work
- Modifying server-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `internal/server/server.go` | handleSystem, handleRules, handleValidate, handleApply, handleRollback (+9) |
| `internal/server/server_test.go` | TestMutatingEndpointsRequireToken, TestMockModeReturnsRules, TestSystemDoesNotExposeSessionToken, TestMissingIptablesReturnsUnavailable, testHandler (+1) |
| `internal/firewall/manager.go` | SystemStatus, nonNilCommands, Rules, Rollback |
| `internal/firewall/runner.go` | NewMockRunner |

## Entry Points

Start here when exploring this area:

- **`NewMockRunner`** (Function) — `internal/firewall/runner.go:80`
- **`TestMutatingEndpointsRequireToken`** (Function) — `internal/server/server_test.go:15`
- **`TestMockModeReturnsRules`** (Function) — `internal/server/server_test.go:27`
- **`TestSystemDoesNotExposeSessionToken`** (Function) — `internal/server/server_test.go:42`
- **`TestMissingIptablesReturnsUnavailable`** (Function) — `internal/server/server_test.go:57`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `NewMockRunner` | Function | `internal/firewall/runner.go` | 80 |
| `TestMutatingEndpointsRequireToken` | Function | `internal/server/server_test.go` | 15 |
| `TestMockModeReturnsRules` | Function | `internal/server/server_test.go` | 27 |
| `TestSystemDoesNotExposeSessionToken` | Function | `internal/server/server_test.go` | 42 |
| `TestMissingIptablesReturnsUnavailable` | Function | `internal/server/server_test.go` | 57 |
| `New` | Function | `internal/server/server.go` | 29 |
| `SystemStatus` | Method | `internal/firewall/manager.go` | 26 |
| `Rules` | Method | `internal/firewall/manager.go` | 57 |
| `Rollback` | Method | `internal/firewall/manager.go` | 102 |
| `nonNilCommands` | Function | `internal/firewall/manager.go` | 50 |
| `decodeJSON` | Function | `internal/server/server.go` | 113 |
| `writeJSON` | Function | `internal/server/server.go` | 120 |
| `writeError` | Function | `internal/server/server.go` | 126 |
| `statusForError` | Function | `internal/server/server.go` | 132 |
| `testHandler` | Function | `internal/server/server_test.go` | 69 |
| `testFS` | Function | `internal/server/server_test.go` | 78 |
| `withCommonHeaders` | Function | `internal/server/server.go` | 149 |
| `spaHandler` | Function | `internal/server/server.go` | 158 |
| `handleSystem` | Method | `internal/server/server.go` | 48 |
| `handleRules` | Method | `internal/server/server.go` | 52 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Main → WriteJSON` | cross_community | 5 |
| `HandleApply → AllowedChain` | cross_community | 5 |
| `HandleApply → AllowedFilterTarget` | cross_community | 5 |
| `HandleApply → AllowedProtocol` | cross_community | 5 |
| `HandleApply → ValidCIDROrIP` | cross_community | 5 |
| `HandleApply → ValidPort` | cross_community | 5 |
| `HandleRules → Policy` | cross_community | 5 |
| `HandleRules → AllowedChain` | cross_community | 5 |
| `HandleRules → AllowedPolicy` | cross_community | 5 |
| `HandleRollback → Policy` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Firewall | 6 calls |

## How to Explore

1. `gitnexus_context({name: "NewMockRunner"})` — see callers and callees
2. `gitnexus_query({query: "server"})` — find related execution flows
3. Read key files listed above for implementation details
