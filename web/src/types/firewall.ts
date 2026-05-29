export type CommandStatus = {
  name: string
  path?: string
  available: boolean
  error?: string
}

export type SystemStatus = {
  host: string
  user: string
  addr: string
  mock: boolean
  root: boolean
  commands: CommandStatus[]
  capabilities: string[]
}

export type Policy = {
  table: string
  chain: string
  policy: "ACCEPT" | "DROP" | string
  order: number
  position?: RulePosition
  counters?: Counters
}

export type FilterRule = {
  id: string
  table: "filter"
  chain: string
  target: string
  protocol?: "" | "tcp" | "udp" | "icmp"
  source?: string
  destination?: string
  inInterface?: string
  outInterface?: string
  sourcePort?: string
  destinationPort?: string
  state?: string
  rejectWith?: string
  logPrefix?: string
  logLevel?: string
  comment?: string
  order: number
  readOnly: boolean
  extra?: string[]
  position?: RulePosition
  counters?: Counters
  sourceLine?: string
}

export type NatRule = {
  id: string
  type: "port-forward" | "masquerade" | "snat" | "redirect" | "jump"
  table: "nat"
  chain: string
  protocol?: "tcp" | "udp" | ""
  listenPort?: string
  destinationIp?: string
  destinationPort?: string
  sourceCidr?: string
  destinationCidr?: string
  inInterface?: string
  outInterface?: string
  comment?: string
  target?: string
  toDestination?: string
  toSource?: string
  toPorts?: string
  order: number
  readOnly: boolean
  extra?: string[]
  position?: RulePosition
  counters?: Counters
  sourceLine?: string
}

export type RawRule = {
  id: string
  table: string
  chain?: string
  line: string
  order: number
  reason: string
  readOnly: boolean
  position?: RulePosition
  counters?: Counters
}

export type Ruleset = {
  snapshotId: string
  raw?: string
  tables?: TableInfo[]
  policies: Policy[]
  filterRules: FilterRule[]
  natRules: NatRule[]
  rawRules: RawRule[]
  warnings?: string[]
  diagnostics?: Diagnostics
}

export type RulePosition = {
  tableOrder?: number
  chainOrder?: number
  saveOrder?: number
  lineNumber?: number
}

export type Counters = {
  packets?: number
  bytes?: number
}

export type TableInfo = {
  name: string
  order: number
  present: boolean
  chains: ChainInfo[]
}

export type ChainInfo = {
  table: string
  name: string
  policy?: string
  builtIn: boolean
  order: number
  lineCount: number
  counters?: Counters
}

export type Diagnostics = {
  commands?: CommandDiagnostic[]
}

export type CommandDiagnostic = {
  name: string
  args?: string[]
  stdout?: string
  stderr?: string
  exitCode: number
  error?: string
  durationMs: number
}

export type RulesResponse = {
  ruleset: Ruleset
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
}
