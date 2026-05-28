---
name: cluster-11
description: "Skill for the Cluster_11 area of iptables-config-ui. 4 symbols across 1 files."
---

# Cluster_11

4 symbols | 1 files | Cohesion: 60%

## When to Use

- Working with code in `web/`
- Understanding how validate, shutdown, ApiError work
- Modifying cluster_11-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web/src/api.ts` | ApiError, request, validate, shutdown |

## Entry Points

Start here when exploring this area:

- **`validate`** (Function) — `web/src/api.ts:31`
- **`shutdown`** (Function) — `web/src/api.ts:49`
- **`ApiError`** (Class) — `web/src/api.ts:2`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ApiError` | Class | `web/src/api.ts` | 2 |
| `validate` | Function | `web/src/api.ts` | 31 |
| `shutdown` | Function | `web/src/api.ts` | 49 |
| `request` | Function | `web/src/api.ts` | 12 |

## How to Explore

1. `gitnexus_context({name: "validate"})` — see callers and callees
2. `gitnexus_query({query: "cluster_11"})` — find related execution flows
3. Read key files listed above for implementation details
