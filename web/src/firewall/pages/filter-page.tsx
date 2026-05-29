import { useCallback, useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronUp, Edit3, Plus, Trash2 } from "lucide-react"

import { SortableDataTable } from "@/components/sortable-data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import type { FilterRule, Ruleset } from "@/types/firewall"

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
import { RuleMatch } from "../components/rule-match"
import { StatusBadge } from "../components/status-badge"
import { targetTone } from "../rule-tone"

export function FilterRulesPanel({
  ruleset,
  onChange,
  onCreate,
  onEdit,
}: {
  ruleset: Ruleset
  onChange: (ruleset: Ruleset) => void
  onCreate: (initialChain?: string) => void
  onEdit: (rule: FilterRule) => void
}) {
  const { t } = useI18n()
  const chains = useMemo(() => tableChainNames(ruleset, "filter"), [ruleset])
  const [chainFilter, setChainFilter] = useState(ALL_CHAINS_VALUE)
  const sortedRows = useMemo(
    () => [...ruleset.filterRules].sort((a, b) => a.order - b.order),
    [ruleset.filterRules]
  )
  const chainSections = useMemo(
    () =>
      chains.map((chain) => ({
        chain,
        builtIn: isBuiltInChain("filter", chain),
        count: sortedRows.filter((rule) => rule.chain === chain).length,
        policy: policyForChain(ruleset, "filter", chain),
        rows: sortedRows.filter((rule) => rule.chain === chain),
      })),
    [chains, ruleset, sortedRows]
  )
  const visibleSections = useMemo(() => {
    if (chainFilter !== ALL_CHAINS_VALUE) {
      return chainSections.filter((section) => section.chain === chainFilter)
    }

    const populatedSections = chainSections.filter(
      (section) => section.count > 0
    )
    return populatedSections.length ? populatedSections : chainSections
  }, [chainFilter, chainSections])

  useEffect(() => {
    if (chainFilter !== ALL_CHAINS_VALUE && !chains.includes(chainFilter)) {
      setChainFilter(ALL_CHAINS_VALUE)
    }
  }, [chainFilter, chains])

  const remove = useCallback(
    (rule: FilterRule) => {
      onChange({
        ...ruleset,
        filterRules: ruleset.filterRules.filter((item) => item.id !== rule.id),
      })
    },
    [onChange, ruleset]
  )

  const move = useCallback(
    (rule: FilterRule, direction: -1 | 1, visibleRows: FilterRule[]) => {
      onChange({
        ...ruleset,
        filterRules: moveRuleByVisibleOrder(
          ruleset.filterRules,
          visibleRows,
          rule,
          direction
        ),
      })
    },
    [onChange, ruleset]
  )

  const reorder = useCallback(
    (activeId: string, overId: string, visibleRows: FilterRule[]) => {
      onChange({
        ...ruleset,
        filterRules: reorderRulesByVisibleDrop(
          ruleset.filterRules,
          visibleRows,
          activeId,
          overId
        ),
      })
    },
    [onChange, ruleset]
  )

  const columnsForRows = useCallback(
    (sectionRows: FilterRule[]): ColumnDef<FilterRule>[] => [
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
        header: t("columnTarget"),
        cell: ({ row }) => (
          <StatusBadge tone={targetTone(row.original.target)}>
            {row.original.target}
          </StatusBadge>
        ),
        size: 96,
      },
      {
        header: t("columnMatch"),
        cell: ({ row }) => <RuleMatch rule={row.original} />,
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
                label={t("moveRuleUp")}
                onClick={() => move(row.original, -1, sectionRows)}
                disabled={index <= 0}
              >
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton
                label={t("moveRuleDown")}
                onClick={() => move(row.original, 1, sectionRows)}
                disabled={index >= sectionRows.length - 1}
              >
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton
                label={t("editRule")}
                onClick={() => onEdit(row.original)}
              >
                <Edit3 className="size-4" />
              </IconButton>
              <IconButton
                label={t("deleteRule")}
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
              {t("filterRulesTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("filterRulesDescription")}
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
                    <StatusBadge
                      tone={section.policy === "DROP" ? "danger" : "muted"}
                    >
                      {t("policyLabel")}: {section.policy}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("chainRuleCount", { count: section.count })}
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
              <div className="p-3">
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
                    ariaLabel={`${section.chain} ${t("filterRulesTitle")}`}
                    density="compact"
                  />
                ) : (
                  <ChainEmptyState
                    message={t("noRulesInChain")}
                    actionLabel={t("addRule")}
                    onAction={() => onCreate(section.chain)}
                  />
                )}
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
        <PoliciesEditor ruleset={ruleset} onChange={onChange} table="filter" />
        <ChainManager ruleset={ruleset} onChange={onChange} table="filter" />
      </aside>
    </section>
  )
}
