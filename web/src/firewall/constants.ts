import type { Ruleset } from "@/types/firewall"

import type { TableName } from "./types"

export const SESSION_TOKEN_KEY = "iptables-config-ui-session-token"
export const BUILT_IN_CHAINS: Record<TableName, string[]> = {
  filter: ["INPUT", "FORWARD", "OUTPUT"],
  nat: ["PREROUTING", "INPUT", "OUTPUT", "POSTROUTING"],
}
export const FILTER_TARGETS = ["ACCEPT", "DROP", "REJECT", "RETURN"]
export const CHAIN_NAME_RE = /^[A-Za-z0-9_.:+-]{1,32}$/
export const ALL_CHAINS_VALUE = "__iptables-ui/all-chains"
export const SNAPSHOT_DRIFT_MESSAGE =
  "live iptables rules changed since draft was loaded"
export const COMMANDS_UNAVAILABLE_MESSAGE = "iptables commands unavailable"

export const emptyRuleset: Ruleset = {
  snapshotId: "",
  tables: [],
  policies: [],
  filterRules: [],
  natRules: [],
  rawRules: [],
  warnings: [],
  diagnostics: { commands: [] },
}
