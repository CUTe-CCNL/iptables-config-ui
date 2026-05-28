---
name: ui
description: "Skill for the Ui area of iptables-config-ui. 25 symbols across 7 files."
---

# Ui

25 symbols | 7 files | Cohesion: 78%

## When to Use

- Working with code in `web/`
- Understanding how cn, nextOrder, App work
- Modifying ui-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `web/src/App.tsx` | App, FirewallApp, updateDraft, FilterRulesPanel, NatPanel (+10) |
| `web/src/components/ui/forms.tsx` | Field, Input, Select |
| `web/src/lib/utils.ts` | cn, nextOrder |
| `web/src/components/ui/dialog.tsx` | Dialog, ConfirmDialog |
| `web/src/components/ui/badge.tsx` | Badge |
| `web/src/components/ui/data-table.tsx` | DataTable |
| `web/src/components/ui/button.tsx` | Button |

## Entry Points

Start here when exploring this area:

- **`cn`** (Function) — `web/src/lib/utils.ts:0`
- **`nextOrder`** (Function) — `web/src/lib/utils.ts:23`
- **`App`** (Function) — `web/src/App.tsx:44`
- **`Badge`** (Function) — `web/src/components/ui/badge.tsx:8`
- **`DataTable`** (Function) — `web/src/components/ui/data-table.tsx:9`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `cn` | Function | `web/src/lib/utils.ts` | 0 |
| `nextOrder` | Function | `web/src/lib/utils.ts` | 23 |
| `App` | Function | `web/src/App.tsx` | 44 |
| `Badge` | Function | `web/src/components/ui/badge.tsx` | 8 |
| `DataTable` | Function | `web/src/components/ui/data-table.tsx` | 9 |
| `Button` | Function | `web/src/components/ui/button.tsx` | 12 |
| `Dialog` | Function | `web/src/components/ui/dialog.tsx` | 14 |
| `ConfirmDialog` | Function | `web/src/components/ui/dialog.tsx` | 47 |
| `Field` | Function | `web/src/components/ui/forms.tsx` | 9 |
| `Input` | Function | `web/src/components/ui/forms.tsx` | 19 |
| `Select` | Function | `web/src/components/ui/forms.tsx` | 23 |
| `FirewallApp` | Function | `web/src/App.tsx` | 81 |
| `updateDraft` | Function | `web/src/App.tsx` | 185 |
| `FilterRulesPanel` | Function | `web/src/App.tsx` | 333 |
| `NatPanel` | Function | `web/src/App.tsx` | 412 |
| `RawPanel` | Function | `web/src/App.tsx` | 506 |
| `StatusCard` | Function | `web/src/App.tsx` | 819 |
| `ToastMessage` | Function | `web/src/App.tsx` | 828 |
| `confirmTitle` | Function | `web/src/App.tsx` | 888 |
| `confirmDescription` | Function | `web/src/App.tsx` | 895 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `FirewallApp → Cn` | cross_community | 4 |
| `FirewallApp → ReadSessionToken` | cross_community | 3 |
| `FirewallApp → Clone` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_15 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "cn"})` — see callers and callees
2. `gitnexus_query({query: "ui"})` — find related execution flows
3. Read key files listed above for implementation details
