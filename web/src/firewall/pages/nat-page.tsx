import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronUp, Edit3, Plus, Trash2 } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { SortableDataTable } from "@/components/sortable-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import type { NatRule, RawRule, Ruleset } from "@/types/firewall"

import { ALL_CHAINS_VALUE } from "../constants"
import {
  isBuiltInChain,
  moveRuleByVisibleOrder,
  policyForChain,
  reorderRulesByVisibleDrop,
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
    () => [...ruleset.natRules].sort((a, b) => a.order - b.order),
    [ruleset.natRules]
  )
  const rawRows = useMemo(
    () =>
      [...ruleset.rawRules]
        .filter((rule) => rule.table === "nat")
        .sort((a, b) => a.order - b.order),
    [ruleset.rawRules]
  )
  const chainSections = useMemo(
    () =>
      chains.map((chain) => {
        const rows = sortedRows.filter((rule) => rule.chain === chain)
        const readOnlyRows = rawRows.filter((rule) => rule.chain === chain)

        return {
          chain,
          builtIn: isBuiltInChain("nat", chain),
          count: rows.length,
          rawCount: readOnlyRows.length,
          policy: policyForChain(ruleset, "nat", chain),
          rows,
          rawRows: readOnlyRows,
        }
      }),
    [chains, rawRows, ruleset, sortedRows]
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
    (sectionRows: NatRule[]): ColumnDef<NatRule>[] => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.order}
          </span>
        ),
        size: 72,
      },
      {
        header: t("columnType"),
        cell: ({ row }) => (
          <StatusBadge
            tone={row.original.type === "port-forward" ? "warning" : "success"}
          >
            {row.original.type === "port-forward"
              ? t("portForwardTitle")
              : "MASQUERADE"}
          </StatusBadge>
        ),
        size: 130,
      },
      {
        header: t("columnMatch"),
        cell: ({ row }) =>
          row.original.type === "port-forward" ? (
            <span className="font-mono text-xs">
              {row.original.protocol}/{row.original.listenPort} -&gt;{" "}
              {row.original.destinationIp}:{row.original.destinationPort}
            </span>
          ) : (
            <span className="font-mono text-xs">
              {t("sourceLabel")} {row.original.sourceCidr || t("any")} -&gt;{" "}
              {row.original.outInterface || t("anyInterface")}
            </span>
          ),
      },
      {
        header: t("columnScope"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.inInterface ? `in:${row.original.inInterface} ` : ""}
            {row.original.outInterface
              ? `out:${row.original.outInterface} `
              : ""}
            {row.original.sourceCidr ? `src:${row.original.sourceCidr}` : ""}
          </span>
        ),
      },
      {
        header: t("columnComment"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.comment || "-"}
          </span>
        ),
      },
      {
        header: t("columnActions"),
        cell: ({ row }) => {
          const index = sectionRows.findIndex(
            (item) => item.id === row.original.id
          )
          return (
            <div className="flex items-center justify-end gap-1">
              <IconButton
                label={t("moveNatRuleUp")}
                onClick={() => move(row.original, -1, sectionRows)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label={t("moveNatRuleDown")}
                onClick={() => move(row.original, 1, sectionRows)}
                disabled={index >= sectionRows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label={t("editNatRule")}
                onClick={() => onEdit(row.original)}
              >
                <Edit3 className="size-4" />
              </IconButton>
              <IconButton
                label={t("deleteNatRule")}
                onClick={() => remove(row.original)}
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
  const rawColumns = useMemo<ColumnDef<RawRule>[]>(
    () => [
      {
        header: t("columnOrder"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.order}
          </span>
        ),
        size: 72,
      },
      {
        header: t("columnLine"),
        cell: ({ row }) => (
          <code className="block min-w-80 font-mono text-xs whitespace-nowrap">
            {row.original.line}
          </code>
        ),
      },
      {
        header: t("columnReason"),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.reason}
          </span>
        ),
      },
    ],
    [t]
  )

  return (
    <section className="grid items-start gap-4 xl:grid-cols-[15rem_minmax(0,1fr)_20rem]">
      <ChainNavigation
        title={t("chainDirectory")}
        description={t("chainDirectoryDescription")}
        items={chainSections}
        activeValue={chainFilter}
        allCount={sortedRows.length + rawRows.length}
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
          {visibleSections.map((section) => (
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
                    onReorder={(activeId, overId) =>
                      reorder(activeId, overId, section.rows)
                    }
                    ariaLabel={`${section.chain} ${t("natRulesTitle")}`}
                    density="compact"
                  />
                ) : null}
                {section.rawRows.length ? (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-medium tracking-normal">
                        {t("readOnlyRules")}
                      </h4>
                      <Badge variant="secondary">
                        {t("readOnlyCount", { count: section.rawRows.length })}
                      </Badge>
                    </div>
                    <DataTable
                      data={section.rawRows}
                      columns={rawColumns}
                      empty={t("noUnsupportedRules")}
                      ariaLabel={`${section.chain} ${t("natRawTitle")}`}
                      density="compact"
                    />
                  </div>
                ) : null}
                {!section.rows.length && !section.rawRows.length ? (
                  <ChainEmptyState
                    message={t("noRulesInChain")}
                    actionLabel={t("addRule")}
                    onAction={() => onCreate(section.chain)}
                  />
                ) : null}
              </div>
            </section>
          ))}
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
