export type CommandStatus = {
  name: string;
  path?: string;
  available: boolean;
  error?: string;
};

export type SystemStatus = {
  host: string;
  user: string;
  addr: string;
  mock: boolean;
  root: boolean;
  commands: CommandStatus[];
  capabilities: string[];
};

export type Policy = {
  table: string;
  chain: string;
  policy: "ACCEPT" | "DROP" | string;
  order: number;
};

export type FilterRule = {
  id: string;
  table: "filter";
  chain: "INPUT" | "OUTPUT" | "FORWARD";
  target: "ACCEPT" | "DROP" | "REJECT";
  protocol?: "" | "tcp" | "udp" | "icmp";
  source?: string;
  destination?: string;
  inInterface?: string;
  outInterface?: string;
  sourcePort?: string;
  destinationPort?: string;
  comment?: string;
  order: number;
  readOnly: boolean;
  extra?: string[];
};

export type NatRule = {
  id: string;
  type: "port-forward" | "masquerade";
  table: "nat";
  chain: "PREROUTING" | "POSTROUTING";
  protocol?: "tcp" | "udp" | "";
  listenPort?: string;
  destinationIp?: string;
  destinationPort?: string;
  sourceCidr?: string;
  inInterface?: string;
  outInterface?: string;
  comment?: string;
  target?: string;
  toDestination?: string;
  order: number;
  readOnly: boolean;
  extra?: string[];
};

export type RawRule = {
  id: string;
  table: string;
  chain?: string;
  line: string;
  order: number;
  reason: string;
  readOnly: boolean;
};

export type Ruleset = {
  snapshotId: string;
  raw?: string;
  policies: Policy[];
  filterRules: FilterRule[];
  natRules: NatRule[];
  rawRules: RawRule[];
  warnings?: string[];
};

export type RulesResponse = {
  ruleset: Ruleset;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
