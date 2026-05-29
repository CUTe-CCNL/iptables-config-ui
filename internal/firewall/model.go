package firewall

type CommandStatus struct {
	Name      string `json:"name"`
	Path      string `json:"path,omitempty"`
	Available bool   `json:"available"`
	Error     string `json:"error,omitempty"`
}

type SystemStatus struct {
	Host         string          `json:"host"`
	User         string          `json:"user"`
	Addr         string          `json:"addr"`
	Mock         bool            `json:"mock"`
	Root         bool            `json:"root"`
	Commands     []CommandStatus `json:"commands"`
	Capabilities []string        `json:"capabilities"`
}

type Ruleset struct {
	SnapshotID  string      `json:"snapshotId"`
	Raw         string      `json:"raw,omitempty"`
	Tables      []TableInfo `json:"tables,omitempty"`
	Policies    []Policy    `json:"policies"`
	FilterRules []Rule      `json:"filterRules"`
	NatRules    []NatRule   `json:"natRules"`
	RawRules    []RawRule   `json:"rawRules"`
	Warnings    []string    `json:"warnings,omitempty"`
	Diagnostics Diagnostics `json:"diagnostics,omitempty"`
}

type Policy struct {
	Table    string       `json:"table"`
	Chain    string       `json:"chain"`
	Policy   string       `json:"policy"`
	Order    int          `json:"order"`
	Position RulePosition `json:"position,omitempty"`
	Counters Counters     `json:"counters,omitempty"`
}

type Rule struct {
	ID              string       `json:"id"`
	Table           string       `json:"table"`
	Chain           string       `json:"chain"`
	Target          string       `json:"target"`
	Protocol        string       `json:"protocol,omitempty"`
	Source          string       `json:"source,omitempty"`
	Destination     string       `json:"destination,omitempty"`
	InInterface     string       `json:"inInterface,omitempty"`
	OutInterface    string       `json:"outInterface,omitempty"`
	SourcePort      string       `json:"sourcePort,omitempty"`
	DestinationPort string       `json:"destinationPort,omitempty"`
	State           string       `json:"state,omitempty"`
	RejectWith      string       `json:"rejectWith,omitempty"`
	LogPrefix       string       `json:"logPrefix,omitempty"`
	LogLevel        string       `json:"logLevel,omitempty"`
	Comment         string       `json:"comment,omitempty"`
	Order           int          `json:"order"`
	ReadOnly        bool         `json:"readOnly"`
	Extra           []string     `json:"extra,omitempty"`
	Position        RulePosition `json:"position,omitempty"`
	Counters        Counters     `json:"counters,omitempty"`
	SourceLine      string       `json:"sourceLine,omitempty"`
}

type NatRule struct {
	ID              string       `json:"id"`
	Type            string       `json:"type"`
	Table           string       `json:"table"`
	Chain           string       `json:"chain"`
	Protocol        string       `json:"protocol,omitempty"`
	ListenPort      string       `json:"listenPort,omitempty"`
	DestinationIP   string       `json:"destinationIp,omitempty"`
	DestinationPort string       `json:"destinationPort,omitempty"`
	SourceCIDR      string       `json:"sourceCidr,omitempty"`
	DestinationCIDR string       `json:"destinationCidr,omitempty"`
	InInterface     string       `json:"inInterface,omitempty"`
	OutInterface    string       `json:"outInterface,omitempty"`
	Comment         string       `json:"comment,omitempty"`
	Target          string       `json:"target,omitempty"`
	ToDestination   string       `json:"toDestination,omitempty"`
	ToSource        string       `json:"toSource,omitempty"`
	ToPorts         string       `json:"toPorts,omitempty"`
	Order           int          `json:"order"`
	ReadOnly        bool         `json:"readOnly"`
	Extra           []string     `json:"extra,omitempty"`
	Position        RulePosition `json:"position,omitempty"`
	Counters        Counters     `json:"counters,omitempty"`
	SourceLine      string       `json:"sourceLine,omitempty"`
}

type RawRule struct {
	ID       string       `json:"id"`
	Table    string       `json:"table"`
	Chain    string       `json:"chain,omitempty"`
	Line     string       `json:"line"`
	Order    int          `json:"order"`
	Reason   string       `json:"reason"`
	ReadOnly bool         `json:"readOnly"`
	Position RulePosition `json:"position,omitempty"`
	Counters Counters     `json:"counters,omitempty"`
}

type TableInfo struct {
	Name    string      `json:"name"`
	Order   int         `json:"order"`
	Present bool        `json:"present"`
	Chains  []ChainInfo `json:"chains"`
}

type ChainInfo struct {
	Table     string   `json:"table"`
	Name      string   `json:"name"`
	Policy    string   `json:"policy,omitempty"`
	BuiltIn   bool     `json:"builtIn"`
	Order     int      `json:"order"`
	LineCount int      `json:"lineCount"`
	Counters  Counters `json:"counters,omitempty"`
}

type RulePosition struct {
	TableOrder int `json:"tableOrder,omitempty"`
	ChainOrder int `json:"chainOrder,omitempty"`
	SaveOrder  int `json:"saveOrder,omitempty"`
	LineNumber int `json:"lineNumber,omitempty"`
}

type Counters struct {
	Packets uint64 `json:"packets,omitempty"`
	Bytes   uint64 `json:"bytes,omitempty"`
}

type Diagnostics struct {
	Commands []CommandDiagnostic `json:"commands,omitempty"`
}

type CommandDiagnostic struct {
	Name       string   `json:"name"`
	Args       []string `json:"args,omitempty"`
	Stdout     string   `json:"stdout,omitempty"`
	Stderr     string   `json:"stderr,omitempty"`
	ExitCode   int      `json:"exitCode"`
	Error      string   `json:"error,omitempty"`
	DurationMs int64    `json:"durationMs"`
}

type ApplyRequest struct {
	SnapshotID string  `json:"snapshotId"`
	Ruleset    Ruleset `json:"ruleset"`
}

type ValidateRequest struct {
	Ruleset Ruleset `json:"ruleset"`
}

type ValidationResult struct {
	Valid  bool     `json:"valid"`
	Errors []string `json:"errors"`
}

type RulesResponse struct {
	Ruleset Ruleset `json:"ruleset"`
}

func (rs *Ruleset) Normalize() {
	if rs.Tables == nil {
		rs.Tables = []TableInfo{}
	}
	if rs.Policies == nil {
		rs.Policies = []Policy{}
	}
	if rs.FilterRules == nil {
		rs.FilterRules = []Rule{}
	}
	if rs.NatRules == nil {
		rs.NatRules = []NatRule{}
	}
	if rs.RawRules == nil {
		rs.RawRules = []RawRule{}
	}
	if rs.Warnings == nil {
		rs.Warnings = []string{}
	}
	if rs.Diagnostics.Commands == nil {
		rs.Diagnostics.Commands = []CommandDiagnostic{}
	}
}
