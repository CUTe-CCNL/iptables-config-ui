import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useI18n } from "@/lib/i18n"
import type { Ruleset, SystemStatus } from "@/types/firewall"

export function StatusCards({
  loading,
  system,
  rules,
  draft,
  pendingCount,
}: {
  loading: boolean
  system: SystemStatus | null
  rules: Ruleset | null
  draft: Ruleset | null
  pendingCount: number
}) {
  const { t } = useI18n()
  const items = [
    {
      label: t("statusListenAddress"),
      value: system?.addr ?? "127.0.0.1:8921",
    },
    {
      label: t("statusSnapshot"),
      value: rules?.snapshotId
        ? rules.snapshotId.slice(0, 12)
        : t("unavailable"),
    },
    {
      label: t("statusFilterRules"),
      value: String(draft?.filterRules.length ?? 0),
    },
    { label: t("statusNatRules"), value: String(draft?.natRules.length ?? 0) },
    { label: t("statusRawLines"), value: String(draft?.rawRules.length ?? 0) },
    { label: t("statusPendingChanges"), value: String(pendingCount) },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="font-mono text-lg">
              {loading ? <Skeleton className="h-6 w-24" /> : item.value}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </section>
  )
}
