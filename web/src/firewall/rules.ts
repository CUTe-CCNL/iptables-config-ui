import { clone } from "@/lib/utils"
import type { RawRule, Ruleset } from "@/types/firewall"

import { BUILT_IN_CHAINS } from "./constants"
import type { TableName } from "./types"

export function tableChainNames(ruleset: Ruleset, table: TableName) {
  const chains = new Set(BUILT_IN_CHAINS[table])
  const policies = [...ruleset.policies]
    .filter((policy) => policy.table === table)
    .sort((a, b) => a.order - b.order)
  policies.forEach((policy) => chains.add(policy.chain))
  if (table === "filter") {
    ruleset.filterRules.forEach((rule) => chains.add(rule.chain))
  } else {
    ruleset.natRules.forEach((rule) => chains.add(rule.chain))
  }
  ruleset.rawRules.forEach((rule) => {
    if (rule.table === table && rule.chain) {
      chains.add(rule.chain)
    }
  })
  return [...chains]
}

export function policyForChain(
  ruleset: Ruleset,
  table: TableName,
  chain: string
) {
  return (
    ruleset.policies.find(
      (policy) => policy.table === table && policy.chain === chain
    )?.policy ?? "-"
  )
}

export function preferredChain(chains: string[], preferred: string) {
  return chains.includes(preferred) ? preferred : (chains[0] ?? preferred)
}

export function groupRawRules(rawRules: RawRule[]) {
  const groups = new Map<
    string,
    { table: string; chain: string; rows: RawRule[] }
  >()

  ;[...rawRules]
    .sort(
      (a, b) =>
        a.table.localeCompare(b.table) ||
        (a.chain || "").localeCompare(b.chain || "") ||
        a.order - b.order
    )
    .forEach((rule) => {
      const key = `${rule.table}:${rule.chain || ""}`
      const group = groups.get(key) ?? {
        table: rule.table,
        chain: rule.chain || "",
        rows: [],
      }
      group.rows.push(rule)
      groups.set(key, group)
    })

  return [...groups.values()]
}

export function isBuiltInChain(table: TableName, chain: string) {
  return BUILT_IN_CHAINS[table].includes(chain)
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values)]
}

export function moveRuleByVisibleOrder<T extends { id: string; order: number }>(
  allRules: T[],
  visibleRows: T[],
  rule: T,
  direction: -1 | 1
) {
  const index = visibleRows.findIndex((item) => item.id === rule.id)
  const next = visibleRows[index + direction]
  if (!next) {
    return allRules
  }

  return allRules.map((item) => {
    if (item.id === rule.id) {
      return { ...item, order: next.order }
    }

    if (item.id === next.id) {
      return { ...item, order: rule.order }
    }

    return item
  })
}

export function reorderRulesByVisibleDrop<
  T extends { id: string; order: number },
>(allRules: T[], visibleRows: T[], activeId: string, overId: string) {
  const activeIndex = visibleRows.findIndex((item) => item.id === activeId)
  const overIndex = visibleRows.findIndex((item) => item.id === overId)
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return allRules
  }

  const reordered = [...visibleRows]
  const [active] = reordered.splice(activeIndex, 1)
  reordered.splice(overIndex, 0, active)

  const orderById = new Map(
    reordered.map((item, index) => [item.id, visibleRows[index].order])
  )

  return allRules.map((item) => {
    const order = orderById.get(item.id)
    return order === undefined ? item : { ...item, order }
  })
}

export function hasExternalChainReference(
  ruleset: Ruleset,
  table: TableName,
  chain: string
) {
  if (
    table === "filter" &&
    ruleset.filterRules.some(
      (rule) => rule.chain !== chain && rule.target === chain
    )
  ) {
    return true
  }

  return ruleset.rawRules.some(
    (rule) =>
      rule.table === table &&
      rule.chain !== chain &&
      rawRuleJumpsToChain(rule.line, chain)
  )
}

function rawRuleJumpsToChain(line: string, chain: string) {
  return new RegExp(
    `(?:^|\\s)(?:-j|--jump)\\s+${escapeRegExp(chain)}(?:\\s|$)`
  ).test(line)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function stripVolatile(rs: Ruleset) {
  const copy = clone(rs)
  delete copy.raw
  delete copy.warnings
  return copy
}
