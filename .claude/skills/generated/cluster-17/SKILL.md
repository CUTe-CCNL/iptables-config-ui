---
name: cluster-17
description: "Skill for the Cluster_17 area of iptables-config-ui. 6 symbols across 2 files."
---

# Cluster_17

6 symbols | 2 files | Cohesion: 83%

## When to Use

- Working with code in `web/`
- Understanding how reorder work
- Modifying cluster_17-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web/src/App.tsx` | remove, move, cell, RuleMatch, targetTone |
| `web/src/lib/utils.ts` | reorder |

## Entry Points

Start here when exploring this area:

- **`reorder`** (Function) — `web/src/lib/utils.ts:27`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `reorder` | Function | `web/src/lib/utils.ts` | 27 |
| `remove` | Function | `web/src/App.tsx` | 346 |
| `move` | Function | `web/src/App.tsx` | 350 |
| `cell` | Function | `web/src/App.tsx` | 360 |
| `RuleMatch` | Function | `web/src/App.tsx` | 806 |
| `targetTone` | Function | `web/src/App.tsx` | 882 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Ui | 2 calls |

## How to Explore

1. `gitnexus_context({name: "reorder"})` — see callers and callees
2. `gitnexus_query({query: "cluster_17"})` — find related execution flows
3. Read key files listed above for implementation details
