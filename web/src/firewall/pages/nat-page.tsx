import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronUp, Edit3, Plus, Trash2 } from "lucide-react"

import { SortableDataTable } from "@/components/sortable-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import type { NatRule, RawRule, Ruleset } from "@/types/firewall"

import { ALL_CHAINS_VALUE } from "../constants"
import {
  chainOrderFor,
  counterLabel,
  isBuiltInChain,
  moveRuleByVisibleOrder,
  policyForChain,
  reorderRulesByVisibleDrop,
  ruleSortValue,
  tableChainNames,
} from "../rules"
import {
  ChainEmptyState,
  ChainFilterSelect,
  ChainManager,
  ChainNavigation,
  PoliciesEditor,
} from "../components/chain-tools"
import { IconButton } from "../components/icon-button"
import { StatusBadge } from "../components/status-badge"
import type { BadgeTone, TFunction } from "../types"

export function NatPanel({
  ruleset,
  onChange,
  onCreate,
  onEdit,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  onCreate: (initialChain?: string) => void
  onEdit: (rule: NatRule) => void
}) {
  const { t } = useI18n()
  const chains = useMemo(() => tableChainNames(ruleset, "nat"), [ruleset])
  const [chainFilter, setChainFilter] = useState(ALL_CHAINS_VALUE)
  const sortedRows = useMemo(
    () => natDisplayRows(ruleset),
    [ruleset]
  )
  const chainSections = useMemo(
    () =>
      chains.map((chain) => {
        const rows = sortedRows.filter((rule) => rule.chain === chain)

        return {
          chain,
          builtIn: isBuiltInChain("nat", chain),
          count: rows.filter((row) => row.kind === "nat").length,
          rawCount: rows.filter((row) => row.kind === "raw").length,
          policy: policyForChain(ruleset, "nat", chain),
          rows,
        }
      }),
    [chains, ruleset, sortedRows]
  )
  const visibleSections = useMemo(() => {
    if (chainFilter !== ALL_CHAINS_VALUE) {
      return chainSections.filter((section) => section.chain === chainFilter)
    }

    const populatedSections = chainSections.filter(
      (section) => section.count + section.rawCount > 0
    )
    return populatedSections.length ? populatedSections : chainSections
  }, [chainFilter, chainSections])

  useEffect(() => {
    if (chainFilter !== ALL_CHAINS_VALUE && !chains.includes(chainFilter)) {
      setChainFilter(ALL_CHAINS_VALUE)
    }
  }, [chainFilter, chains])

  const remove = useCallback(
    (rule: NatRule) => {
      onChange({
        ...ruleset,
        natRules: ruleset.natRules.filter((item) => item.id !== rule.id),
      })
    },
    [onChange, ruleset]
  )

  const move = useCallback(
    (rule: NatRule, direction: -1 | 1, visibleRows: NatRule[]) => {
      onChange({
        ...ruleset,
        natRules: moveRuleByVisibleOrder(
          ruleset.natRules,
          visibleRows,
          rule,
          direction
        ),
      })
    },
    [onChange, ruleset]
  )

  const reorder = useCallback(
    (activeId: string, overId: string, visibleRows: NatRule[]) => {
      onChange({
        ...ruleset,
        natRules: reorderRulesByVisibleDrop(
          ruleset.natRules,
          visibleRows,
          activeId,
          overId
        ),
      })
    },
    [onChange, ruleset]
  )

  const columnsForRows = useCallback(
    (sectionRows: NatDisplayRow[]): ColumnDef<NatDisplayRow>[] => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <div className="grid gap-0.5 font-mono text-xs text-muted-foreground">
            <span>{row.original.position?.lineNumber ?? row.original.order}</span>
            <span>{counterLabel(row.original)}</span>
          </div>
        ),
        size: 86,
      },
      {
        header: t("columnType"),
        cell: ({ row }) =>
          row.original.kind === "nat" ? (
            <StatusBadge tone={natTone(row.original.rule)}>
              {natLabel(row.original.rule, t)}
            </StatusBadge>
          ) : (
            <Badge variant="outline">{t("readOnlyRules")}</Badge>
          ),
        size: 130,
      },
      {
        header: t("columnMatch"),
        cell: ({ row }) =>
          row.original.kind === "raw" ? (
            <code className="block min-w-80 font-mono text-xs whitespace-nowrap">
              {row.original.rule.line}
            </code>
          ) : row.original.rule.type === "port-forward" ? (
            <span className="font-mono text-xs">
              {row.original.rule.protocol}/{row.original.rule.listenPort} -&gt;{" "}
              {row.original.rule.toDestination ||
                `${row.original.rule.destinationIp}:${row.original.rule.destinationPort}`}
            </span>
          ) : row.original.rule.type === "snat" ? (
            <span className="font-mono text-xs">
              SNAT -&gt; {row.original.rule.toSource}
            </span>
          ) : row.original.rule.type === "redirect" ? (
            <span className="font-mono text-xs">
              REDIRECT {row.original.rule.listenPort || "*"} -&gt;{" "}
              {row.original.rule.toPorts || "*"}
            </span>
          ) : row.original.rule.type === "jump" ? (
            <span className="font-mono text-xs">
              -j {row.original.rule.target}
            </span>
          ) : (
            <span className="font-mono text-xs">
              {t("sourceLabel")} {row.original.rule.sourceCidr || t("any")}{" "}
              -&gt; {row.original.rule.outInterface || t("anyInterface")}
            </span>
          ),
      },
      {
        header: t("columnScope"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.kind === "nat" && row.original.rule.inInterface
              ? `in:${row.original.rule.inInterface} `
              : ""}
            {row.original.kind === "nat" && row.original.rule.outInterface
              ? `out:${row.original.rule.outInterface} `
              : ""}
            {row.original.kind === "nat" && row.original.rule.sourceCidr
              ? `src:${row.original.rule.sourceCidr}`
              : ""}
          </span>
        ),
      },
      {
        header: t("columnComment"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.kind === "nat"
              ? row.original.rule.comment || "-"
              : row.original.rule.reason}
          </span>
        ),
      },
      {
        header: t("columnActions"),
        cell: ({ row }) => {
          const current = row.original
          if (current.kind === "raw") {
            return (
              <div className="flex justify-end">
                <Badge variant="secondary">{t("readOnlyRules")}</Badge>
              </div>
            )
          }

          const editableRows = sectionRows
            .filter((item): item is NatEditableRow => item.kind === "nat")
            .map((item) => item.rule)
          const index = editableRows.findIndex(
            (item) => item.id === current.rule.id
          )
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                label={t("moveNatRuleUp")}
                onClick={() => move(current.rule, -1, editableRows)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label={t("moveNatRuleDown")}
                onClick={() => move(current.rule, 1, editableRows)}
                disabled={index >= editableRows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label={t("editNatRule")}
                onClick={() => onEdit(current.rule)}
              >
                <Edit3 className="size-4" />
              </IconButton>
              <IconButton
                label={t("deleteNatRule")}
                onClick={() => remove(current.rule)}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          )
        },
        size: 180,
      },
    ],
    [move, onEdit, remove, t]
  )

  return (
    <section className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <ChainNavigation
        title={t("chainDirectory")}
        description={t("chainDirectoryDescription")}
        items={chainSections}
        activeValue={chainFilter}
        allCount={sortedRows.length}
        onValueChange={setChainFilter}
      />

      <div className="grid min-w-0 content-start gap-4 self-start">
        <div className="rounded-lg border bg-card p-3 xl:hidden">
          <ChainFilterSelect
            value={chainFilter}
            onValueChange={setChainFilter}
            chains={chains}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-normal">
              {t("natRulesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("natRulesDescription")}
            </p>
          </div>
          <Button
            onClick={() =>
              onCreate(
                chainFilter === ALL_CHAINS_VALUE ? undefined : chainFilter
              )
            }
          >
            <Plus className="size-4" />
            {t("addRule")}
          </Button>
        </div>

        <div className="grid gap-4">
          {visibleSections.length ? visibleSections.map((section) => (
            <section
              key={section.chain}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-mono text-base font-semibold tracking-normal">
                      {section.chain}
                    </h3>
                    <Badge variant="secondary">
                      {section.builtIn
                        ? t("builtInChain")
                        : t("customChainBadge")}
                    </Badge>
                    <StatusBadge tone="muted">
                      {t("policyLabel")}: {section.policy}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("chainRuleCount", { count: section.count })}
                    {section.rawCount
                      ? ` / ${t("readOnlyCount", {
                          count: section.rawCount,
                        })}`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCreate(section.chain)}
                >
                  <Plus className="size-4" />
                  {t("addRule")}
                </Button>
              </div>
              <div className="grid gap-3 p-3">
                {section.rows.length ? (
                  <SortableDataTable
                    data={section.rows}
                    columns={columnsForRows(section.rows)}
                    empty={t("noRulesInChain")}
                    dragLabel={t("dragRuleToReorder")}
                    getRowId={(row) => row.id}
                    canDragRow={(row) => row.kind === "nat"}
                    onReorder={(activeId, overId) =>
                      reorder(
                        activeId,
                        overId,
                        section.rows
                          .filter(
                            (item): item is NatEditableRow =>
                              item.kind === "nat"
                          )
                          .map((item) => item.rule)
                      )
                    }
                    ariaLabel={`${section.chain} ${t("natRulesTitle")}`}
                    density="compact"
                  />
                ) : null}
                {!section.rows.length ? (
                  <ChainEmptyState
                    message={t("noRulesInChain")}
                    actionLabel={t("addRule")}
                    onAction={() => onCreate(section.chain)}
                  />
                ) : null}
              </div>
            </section>
          )) : (
            <ChainEmptyState message={t("noNatRules")} />
          )}
        </div>
      </div>

      <aside className="order-first grid gap-4 self-start xl:sticky xl:top-28 xl:order-none">
        <div className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold tracking-normal">
            {t("tableToolsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("tableToolsDescription")}
          </p>
        </div>
        <PoliciesEditor ruleset={ruleset} onChange={onChange} table="nat" />
        <ChainManager ruleset={ruleset} onChange={onChange} table="nat" />
      </aside>
    </section>
  )
}

type NatEditableRow = {
  id: string
  kind: "nat"
  chain: string
  order: number
  position: NatRule["position"]
  counters: NatRule["counters"]
  rule: NatRule
}

type NatRawRow = {
  id: string
  kind: "raw"
  chain: string
  order: number
  position: RawRule["position"]
  counters: RawRule["counters"]
  rule: RawRule
}

type NatDisplayRow = NatEditableRow | NatRawRow

function natDisplayRows(ruleset: Ruleset): NatDisplayRow[] {
  const rows: NatDisplayRow[] = [
    ...ruleset.natRules.map((rule) => ({
      id: rule.id,
      kind: "nat" as const,
      chain: rule.chain,
      order: rule.order,
      position: rule.position,
      counters: rule.counters,
      rule,
    })),
    ...ruleset.rawRules
      .filter((rule) => rule.table === "nat")
      .map((rule) => ({
        id: rule.id,
        kind: "raw" as const,
        chain: rule.chain || "",
        order: rule.order,
        position: rule.position,
        counters: rule.counters,
        rule,
      })),
  ]

  return rows.sort(
    (a, b) =>
      chainOrderFor(ruleset, "nat", a.chain) -
        chainOrderFor(ruleset, "nat", b.chain) ||
      ruleSortValue(a) - ruleSortValue(b)
  )
}

function natTone(rule: NatRule): BadgeTone {
  switch (rule.type) {
    case "masquerade":
    case "snat":
      return "success"
    case "jump":
      return "muted"
    default:
      return "warning"
  }
}

function natLabel(rule: NatRule, t: TFunction) {
  switch (rule.type) {
    case "port-forward":
      return t("portForwardTitle")
    case "masquerade":
      return "MASQUERADE"
    case "snat":
      return "SNAT"
    case "redirect":
      return "REDIRECT"
    case "jump":
      return rule.target || "JUMP"
    default:
      return rule.type
  }
}
