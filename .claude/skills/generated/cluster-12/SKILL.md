---
name: cluster-12
description: "Skill for the Cluster_12 area of iptables-config-ui. 4 symbols across 1 files."
---

# Cluster_12

4 symbols | 1 files | Cohesion: 75%

## When to Use

- Working with code in `web/`
- Understanding how system, normalizeRuleset work
- Modifying cluster_12-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web/src/api.ts` | system, normalizeRuleset, normalizeSystemStatus, arrayOrEmpty |

## Entry Points

Start here when exploring this area:

- **`system`** (Function) — `web/src/api.ts:29`
- **`normalizeRuleset`** (Function) — `web/src/api.ts:61`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `system` | Function | `web/src/api.ts` | 29 |
| `normalizeRuleset` | Function | `web/src/api.ts` | 61 |
| `normalizeSystemStatus` | Function | `web/src/api.ts` | 72 |
| `arrayOrEmpty` | Function | `web/src/api.ts` | 80 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Rules → ArrayOrEmpty` | cross_community | 4 |
| `Apply → ArrayOrEmpty` | cross_community | 4 |
| `Rollback → ArrayOrEmpty` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_11 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "system"})` — see callers and callees
2. `gitnexus_query({query: "cluster_12"})` — find related execution flows
3. Read key files listed above for implementation details
