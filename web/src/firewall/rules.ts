import { clone } from "@/lib/utils"
import type {
  FilterRule,
  NatRule,
  RawRule,
  RulePosition,
  Ruleset,
} from "@/types/firewall"

import { BUILT_IN_CHAINS } from "./constants"
import type { TableName } from "./types"

export type ChainBindingState = {
  sourceChain: string
  managedRuleIds: string[]
  conditional: boolean
  raw: boolean
}

export function tableChainNames(
  ruleset: Ruleset,
  table: TableName,
  options: { includeDefaults?: boolean } = {}
) {
  const chains = new Set<string>()
  if (options.includeDefaults) {
    BUILT_IN_CHAINS[table].forEach((chain) => chains.add(chain))
  }
  const tableInfo = ruleset.tables?.find((item) => item.name === table)
  ;[...(tableInfo?.chains ?? [])]
    .sort((a, b) => a.order - b.order)
    .forEach((chain) => chains.add(chain.name))
  const policies = [...ruleset.policies]
    .filter((policy) => policy.table === table)
    .sort((a, b) => ruleSortValue(a) - ruleSortValue(b))
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
        (a.position?.tableOrder ?? 999) - (b.position?.tableOrder ?? 999) ||
        a.table.localeCompare(b.table) ||
        (a.position?.chainOrder ?? 999) - (b.position?.chainOrder ?? 999) ||
        (a.chain || "").localeCompare(b.chain || "") ||
        ruleSortValue(a) - ruleSortValue(b)
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

type OrderedRule = { id: string; order: number; position?: RulePosition }

export function moveRuleByVisibleOrder<T extends OrderedRule>(
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
      return withDraftOrder(item, next.order, next.position?.lineNumber)
    }

    if (item.id === next.id) {
      return withDraftOrder(item, rule.order, rule.position?.lineNumber)
    }

    return item
  })
}

export function reorderRulesByVisibleDrop<T extends OrderedRule>(
  allRules: T[],
  visibleRows: T[],
  activeId: string,
  overId: string
) {
  const activeIndex = visibleRows.findIndex((item) => item.id === activeId)
  const overIndex = visibleRows.findIndex((item) => item.id === overId)
  if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
    return allRules
  }

  const reordered = [...visibleRows]
  const [active] = reordered.splice(activeIndex, 1)
  reordered.splice(overIndex, 0, active)

  const orderById = new Map(
    reordered.map((item, index) => [
      item.id,
      {
        lineNumber: visibleRows[index].position?.lineNumber,
        order: visibleRows[index].order,
      },
    ])
  )

  return allRules.map((item) => {
    const next = orderById.get(item.id)
    return next === undefined
      ? item
      : withDraftOrder(item, next.order, next.lineNumber)
  })
}

function withDraftOrder<T extends OrderedRule>(
  item: T,
  order: number,
  lineNumber?: number
): T {
  if (!item.position) {
    return { ...item, order }
  }

  return {
    ...item,
    order,
    position: {
      ...item.position,
      lineNumber: lineNumber ?? item.position.lineNumber,
      saveOrder: order,
    },
  }
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

  if (
    table === "nat" &&
    ruleset.natRules.some(
      (rule) =>
        rule.chain !== chain && rule.type === "jump" && rule.target === chain
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

export function chainBindingStates(
  ruleset: Ruleset,
  table: TableName,
  targetChain: string
): ChainBindingState[] {
  return BUILT_IN_CHAINS[table].map((sourceChain) =>
    chainBindingState(ruleset, table, sourceChain, targetChain)
  )
}

export function chainBindingState(
  ruleset: Ruleset,
  table: TableName,
  sourceChain: string,
  targetChain: string
): ChainBindingState {
  const managedRuleIds =
    table === "filter"
      ? ruleset.filterRules
          .filter((rule) =>
            isManagedFilterChainBinding(rule, sourceChain, targetChain)
          )
          .map((rule) => rule.id)
      : ruleset.natRules
          .filter((rule) =>
            isManagedNatChainBinding(rule, sourceChain, targetChain)
          )
          .map((rule) => rule.id)

  const conditional =
    table === "filter"
      ? ruleset.filterRules.some(
          (rule) =>
            rule.chain === sourceChain &&
            rule.target === targetChain &&
            !isManagedFilterChainBinding(rule, sourceChain, targetChain)
        )
      : ruleset.natRules.some(
          (rule) =>
            rule.chain === sourceChain &&
            rule.type === "jump" &&
            rule.target === targetChain &&
            !isManagedNatChainBinding(rule, sourceChain, targetChain)
        )

  const raw = ruleset.rawRules.some(
    (rule) =>
      rule.table === table &&
      rule.chain === sourceChain &&
      rawRuleJumpsToChain(rule.line, targetChain)
  )

  return { sourceChain, managedRuleIds, conditional, raw }
}

function isManagedFilterChainBinding(
  rule: FilterRule,
  sourceChain: string,
  targetChain: string
) {
  return (
    rule.chain === sourceChain &&
    rule.target === targetChain &&
    !filterRuleHasBindingConditions(rule)
  )
}

function filterRuleHasBindingConditions(rule: FilterRule) {
  return Boolean(
    rule.protocol ||
      rule.source ||
      rule.destination ||
      rule.inInterface ||
      rule.outInterface ||
      rule.sourcePort ||
      rule.destinationPort ||
      rule.state ||
      rule.extra?.length
  )
}

function isManagedNatChainBinding(
  rule: NatRule,
  sourceChain: string,
  targetChain: string
) {
  return (
    rule.chain === sourceChain &&
    rule.type === "jump" &&
    rule.target === targetChain &&
    !natRuleHasBindingConditions(rule)
  )
}

function natRuleHasBindingConditions(rule: NatRule) {
  return Boolean(
    rule.protocol ||
      rule.listenPort ||
      rule.destinationIp ||
      rule.destinationPort ||
      rule.sourceCidr ||
      rule.destinationCidr ||
      rule.inInterface ||
      rule.outInterface ||
      rule.extra?.length
  )
}

function rawRuleJumpsToChain(line: string, chain: string) {
  return new RegExp(
    `(?:^|\\s)(?:-j|--jump|-g|--goto)\\s+${escapeRegExp(chain)}(?:\\s|$)`
  ).test(line)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function stripVolatile(rs: Ruleset) {
  const copy = clone(rs)
  delete copy.raw
  delete copy.warnings
  delete copy.tables
  delete copy.diagnostics
  copy.policies.forEach((policy) => {
    delete policy.position
    delete policy.counters
  })
  copy.filterRules.forEach((rule) => {
    delete rule.position
    delete rule.counters
    delete rule.sourceLine
  })
  copy.natRules.forEach((rule) => {
    delete rule.position
    delete rule.counters
    delete rule.sourceLine
  })
  copy.rawRules.forEach((rule) => {
    delete rule.position
    delete rule.counters
  })
  return copy
}

export function ruleSortValue(
  rule: Pick<FilterRule | NatRule | RawRule, "order" | "position">
) {
  if (rule.position?.saveOrder && rule.position.saveOrder !== rule.order) {
    return rule.order
  }
  return rule.position?.lineNumber ?? rule.position?.saveOrder ?? rule.order
}

export function chainOrderFor(
  ruleset: Ruleset,
  table: TableName,
  chain: string
) {
  const liveOrder = ruleset.tables
    ?.find((item) => item.name === table)
    ?.chains.find((item) => item.name === chain)?.order
  if (liveOrder) return liveOrder

  const builtInIndex = BUILT_IN_CHAINS[table].indexOf(chain)
  return builtInIndex >= 0 ? builtInIndex + 1 : 999
}

export function counterLabel(
  rule: Pick<FilterRule | NatRule | RawRule, "counters">
) {
  const packets = rule.counters?.packets ?? 0
  const bytes = rule.counters?.bytes ?? 0
  return `${packets}/${bytes}`
}
