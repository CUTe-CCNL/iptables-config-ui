---
name: firewall
description: "Skill for the Firewall area of iptables-config-ui. 64 symbols across 10 files."
---

# Firewall

64 symbols | 10 files | Cohesion: 76%

## When to Use

- Working with code in `internal/`
- Understanding how SnapshotID, ParseRuleset, TestParseReturnsEmptyArraysForEmptyTables work
- Modifying firewall-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `internal/firewall/render.go` | RenderRuleset, renderRawOnlyTables, renderTable, tablePolicies, ensureDefaultPolicies (+10) |
| `internal/firewall/validate.go` | ValidateRuleset, allowedPolicy, allowedChain, isSupportedFilterRule, validateNATRule (+8) |
| `internal/firewall/parser.go` | ParseRuleset, parsePolicy, parseAppendLine, toFilterRule, toNATRule (+6) |
| `internal/firewall/parser_test.go` | TestParseReturnsEmptyArraysForEmptyTables, TestRenderPreservesReadOnlyRawRules, TestCustomChainIsReadOnlyInsteadOfInvalidPolicy, TestRenderPreservesUnsupportedTables, TestParseMockRules (+1) |
| `main.go` | main, shutdownHTTPServer, randomToken, modeLabel, accessURLs (+1) |
| `internal/firewall/manager_test.go` | Apply, TestApplyRejectsSnapshotDrift, TestApplyFailureRollsBackCurrentRules, TestRollbackRestoresLastSnapshotOnce, stringsReplaceFirst |
| `internal/firewall/manager.go` | Validate, Apply, NewManager |
| `internal/firewall/runner.go` | MockRules, NewExecRunner, lookupCommand |
| `internal/firewall/hash.go` | SnapshotID |
| `internal/firewall/model.go` | Normalize |

## Entry Points

Start here when exploring this area:

- **`SnapshotID`** (Function) — `internal/firewall/hash.go:7`
- **`ParseRuleset`** (Function) — `internal/firewall/parser.go:8`
- **`TestParseReturnsEmptyArraysForEmptyTables`** (Function) — `internal/firewall/parser_test.go:29`
- **`TestRenderPreservesReadOnlyRawRules`** (Function) — `internal/firewall/parser_test.go:54`
- **`TestCustomChainIsReadOnlyInsteadOfInvalidPolicy`** (Function) — `internal/firewall/parser_test.go:89`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `SnapshotID` | Function | `internal/firewall/hash.go` | 7 |
| `ParseRuleset` | Function | `internal/firewall/parser.go` | 8 |
| `TestParseReturnsEmptyArraysForEmptyTables` | Function | `internal/firewall/parser_test.go` | 29 |
| `TestRenderPreservesReadOnlyRawRules` | Function | `internal/firewall/parser_test.go` | 54 |
| `TestCustomChainIsReadOnlyInsteadOfInvalidPolicy` | Function | `internal/firewall/parser_test.go` | 89 |
| `TestRenderPreservesUnsupportedTables` | Function | `internal/firewall/parser_test.go` | 108 |
| `RenderRuleset` | Function | `internal/firewall/render.go` | 8 |
| `ValidateRuleset` | Function | `internal/firewall/validate.go` | 12 |
| `NewManager` | Function | `internal/firewall/manager.go` | 22 |
| `TestApplyRejectsSnapshotDrift` | Function | `internal/firewall/manager_test.go` | 38 |
| `TestApplyFailureRollsBackCurrentRules` | Function | `internal/firewall/manager_test.go` | 52 |
| `TestRollbackRestoresLastSnapshotOnce` | Function | `internal/firewall/manager_test.go` | 74 |
| `TestParseMockRules` | Function | `internal/firewall/parser_test.go` | 7 |
| `TestValidateRulesetRejectsBadPortForward` | Function | `internal/firewall/parser_test.go` | 74 |
| `MockRules` | Function | `internal/firewall/runner.go` | 110 |
| `NewExecRunner` | Function | `internal/firewall/runner.go` | 27 |
| `Validate` | Method | `internal/firewall/manager.go` | 65 |
| `Apply` | Method | `internal/firewall/manager.go` | 69 |
| `Normalize` | Method | `internal/firewall/model.go` | 102 |
| `Apply` | Method | `internal/firewall/manager_test.go` | 20 |

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
| Server | 2 calls |

## How to Explore

1. `gitnexus_context({name: "SnapshotID"})` — see callers and callees
2. `gitnexus_query({query: "firewall"})` — find related execution flows
3. Read key files listed above for implementation details
