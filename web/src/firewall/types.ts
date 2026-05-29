import type { useI18n } from "@/lib/i18n"
import type { FilterRule, NatRule } from "@/types/firewall"

export type Tab = "overview" | "filter" | "nat" | "raw" | "diagnostics"
export type TableName = "filter" | "nat"
export type ConfirmAction = "apply" | "rollback" | "shutdown" | "refresh" | null
export type FilterEditor =
  | { mode: "create"; initialChain?: string }
  | { mode: "edit"; rule: FilterRule }
  | null
export type NatEditor =
  | { mode: "create"; initialChain?: string }
  | { mode: "edit"; rule: NatRule }
  | null
export type BadgeTone = "default" | "success" | "warning" | "danger" | "muted"
export type FilterProtocolOption = "any" | "tcp" | "udp" | "icmp"
export type TFunction = ReturnType<typeof useI18n>["t"]
export type ErrorDisplay = { title: string; description?: string }
export type ErrorCopy = {
  unknownError: string
  snapshotDriftTitle: string
  snapshotDriftHint: string
  useMockModeHint: string
}
export type FilterRuleFormState = {
  chain: FilterRule["chain"]
  target: FilterRule["target"]
  protocol: FilterProtocolOption
  source: string
  destination: string
  inInterface: string
  outInterface: string
  sourcePort: string
  destinationPort: string
  comment: string
}
export type NatRuleFormState = {
  chain: NatRule["chain"]
  protocol: "tcp" | "udp"
  listenPort: string
  destinationIp: string
  destinationPort: string
  sourceCidr: string
  destinationCidr: string
  inInterface: string
  outInterface: string
  target: string
  toSource: string
  toPorts: string
  comment: string
}
