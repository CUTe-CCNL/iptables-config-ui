---
name: cluster-13
description: "Skill for the Cluster_13 area of iptables-config-ui. 4 symbols across 1 files."
---

# Cluster_13

4 symbols | 1 files | Cohesion: 60%

## When to Use

- Working with code in `web/`
- Understanding how rules, apply, rollback work
- Modifying cluster_13-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web/src/api.ts` | rules, apply, rollback, normalizeRulesResponse |

## Entry Points

Start here when exploring this area:

- **`rules`** (Function) — `web/src/api.ts:30`
- **`apply`** (Function) — `web/src/api.ts:37`
- **`rollback`** (Function) — `web/src/api.ts:43`
- **`normalizeRulesResponse`** (Function) — `web/src/api.ts:57`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `rules` | Function | `web/src/api.ts` | 30 |
| `apply` | Function | `web/src/api.ts` | 37 |
| `rollback` | Function | `web/src/api.ts` | 43 |
| `normalizeRulesResponse` | Function | `web/src/api.ts` | 57 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Rules → ArrayOrEmpty` | cross_community | 4 |
| `Apply → ArrayOrEmpty` | cross_community | 4 |
| `Rollback → ArrayOrEmpty` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_11 | 3 calls |
| Cluster_12 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "rules"})` — see callers and callees
2. `gitnexus_query({query: "cluster_13"})` — find related execution flows
3. Read key files listed above for implementation details
