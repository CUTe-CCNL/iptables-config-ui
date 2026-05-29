import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Terminal } from "lucide-react"

import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useI18n } from "@/lib/i18n"
import type { RawRule, Ruleset } from "@/types/firewall"

import { groupRawRules } from "../rules"
import { StatusBadge } from "../components/status-badge"

export function RawPanel({ ruleset }: { ruleset: Ruleset }) {
  const { t } = useI18n()
  const columns = useMemo<ColumnDef<RawRule>[]>(
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

  const rawGroups = useMemo(
    () => groupRawRules(ruleset.rawRules),
    [ruleset.rawRules]
  )

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-normal">
            {t("rawTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("rawDescription")}</p>
        </div>
        <StatusBadge tone="muted">
          {t("readOnlyCount", { count: ruleset.rawRules.length })}
        </StatusBadge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="grid min-w-0 gap-3">
          {rawGroups.length ? (
            rawGroups.map((group) => (
              <section
                key={`${group.table}-${group.chain}`}
                className="overflow-hidden rounded-lg border bg-card"
              >
                <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{group.table}</Badge>
                    <h3 className="font-mono text-base font-semibold tracking-normal">
                      {group.chain || t("raw")}
                    </h3>
                  </div>
                  <StatusBadge tone="muted">
                    {t("readOnlyCount", { count: group.rows.length })}
                  </StatusBadge>
                </div>
                <div className="p-3">
                  <DataTable
                    data={group.rows}
                    columns={columns}
                    empty={t("noUnsupportedRules")}
                    ariaLabel={`${group.table} ${group.chain} ${t("rawTitle")}`}
                    density="compact"
                  />
                </div>
              </section>
            ))
          ) : (
            <DataTable
              data={[]}
              columns={columns}
              empty={t("noUnsupportedRules")}
              ariaLabel={t("rawTitle")}
              density="compact"
            />
          )}
        </div>

        <div className="grid gap-2 self-start xl:sticky xl:top-28">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Terminal className="size-4" />
            {t("rawSnapshotTitle")}
          </div>
          <ScrollArea className="h-[420px] rounded-lg border bg-zinc-950 p-3 text-zinc-50">
            <pre className="min-w-max font-mono text-xs leading-relaxed">
              {ruleset.raw || t("noRawSnapshot")}
            </pre>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </section>
  )
}
