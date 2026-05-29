import { useI18n } from "@/lib/i18n"
import type { FilterRule } from "@/types/firewall"

export function RuleMatch({ rule }: { rule: FilterRule }) {
  const { t } = useI18n()
  const parts = [
    ["proto", rule.protocol || t("any")],
    ["src", rule.source],
    ["dst", rule.destination],
    ["in", rule.inInterface],
    ["out", rule.outInterface],
    ["sport", rule.sourcePort],
    ["dport", rule.destinationPort],
    ["state", rule.state],
    ["reject", rule.rejectWith],
    ["log", rule.logPrefix || rule.logLevel],
  ].filter(([, value]) => value)

  return (
    <span className="flex min-w-80 flex-wrap gap-1 font-mono text-xs">
      {parts.map(([label, value]) => (
        <span
          key={`${label}-${value}`}
          className="rounded-md border bg-muted/40 px-1.5 py-0.5"
        >
          <span className="text-muted-foreground">{label}:</span>
          {value}
        </span>
      ))}
    </span>
  )
}
