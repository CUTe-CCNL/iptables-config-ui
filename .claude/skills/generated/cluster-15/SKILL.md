---
name: cluster-15
description: "Skill for the Cluster_15 area of iptables-config-ui. 12 symbols across 2 files."
---

# Cluster_15

12 symbols | 2 files | Cohesion: 90%

## When to Use

- Working with code in `web/`
- Understanding how clone, isEqualJSON work
- Modifying cluster_15-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web/src/App.tsx` | pending, pendingCount, boot, refreshRules, runConfirmAction (+5) |
| `web/src/lib/utils.ts` | clone, isEqualJSON |

## Entry Points

Start here when exploring this area:

- **`clone`** (Function) — `web/src/lib/utils.ts:4`
- **`isEqualJSON`** (Function) — `web/src/lib/utils.ts:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `clone` | Function | `web/src/lib/utils.ts` | 4 |
| `isEqualJSON` | Function | `web/src/lib/utils.ts` | 15 |
| `pending` | Function | `web/src/App.tsx` | 98 |
| `pendingCount` | Function | `web/src/App.tsx` | 103 |
| `boot` | Function | `web/src/App.tsx` | 112 |
| `refreshRules` | Function | `web/src/App.tsx` | 131 |
| `runConfirmAction` | Function | `web/src/App.tsx` | 150 |
| `pushToast` | Function | `web/src/App.tsx` | 189 |
| `stripVolatile` | Function | `web/src/App.tsx` | 854 |
| `readSessionToken` | Function | `web/src/App.tsx` | 861 |
| `formatError` | Function | `web/src/App.tsx` | 872 |
| `actionTitle` | Function | `web/src/App.tsx` | 909 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `FirewallApp → ReadSessionToken` | cross_community | 3 |
| `FirewallApp → Clone` | cross_community | 3 |

## How to Explore

1. `gitnexus_context({name: "clone"})` — see callers and callees
2. `gitnexus_query({query: "cluster_15"})` — find related execution flows
3. Read key files listed above for implementation details
