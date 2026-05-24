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
	SnapshotID  string    `json:"snapshotId"`
	Raw         string    `json:"raw,omitempty"`
	Policies    []Policy  `json:"policies"`
	FilterRules []Rule    `json:"filterRules"`
	NatRules    []NatRule `json:"natRules"`
	RawRules    []RawRule `json:"rawRules"`
	Warnings    []string  `json:"warnings,omitempty"`
}

type Policy struct {
	Table  string `json:"table"`
	Chain  string `json:"chain"`
	Policy string `json:"policy"`
	Order  int    `json:"order"`
}

type Rule struct {
	ID              string   `json:"id"`
	Table           string   `json:"table"`
	Chain           string   `json:"chain"`
	Target          string   `json:"target"`
	Protocol        string   `json:"protocol,omitempty"`
	Source          string   `json:"source,omitempty"`
	Destination     string   `json:"destination,omitempty"`
	InInterface     string   `json:"inInterface,omitempty"`
	OutInterface    string   `json:"outInterface,omitempty"`
	SourcePort      string   `json:"sourcePort,omitempty"`
	DestinationPort string   `json:"destinationPort,omitempty"`
	Comment         string   `json:"comment,omitempty"`
	Order           int      `json:"order"`
	ReadOnly        bool     `json:"readOnly"`
	Extra           []string `json:"extra,omitempty"`
}

type NatRule struct {
	ID              string   `json:"id"`
	Type            string   `json:"type"`
	Table           string   `json:"table"`
	Chain           string   `json:"chain"`
	Protocol        string   `json:"protocol,omitempty"`
	ListenPort      string   `json:"listenPort,omitempty"`
	DestinationIP   string   `json:"destinationIp,omitempty"`
	DestinationPort string   `json:"destinationPort,omitempty"`
	SourceCIDR      string   `json:"sourceCidr,omitempty"`
	InInterface     string   `json:"inInterface,omitempty"`
	OutInterface    string   `json:"outInterface,omitempty"`
	Comment         string   `json:"comment,omitempty"`
	Target          string   `json:"target,omitempty"`
	ToDestination   string   `json:"toDestination,omitempty"`
	Order           int      `json:"order"`
	ReadOnly        bool     `json:"readOnly"`
	Extra           []string `json:"extra,omitempty"`
}

type RawRule struct {
	ID       string `json:"id"`
	Table    string `json:"table"`
	Chain    string `json:"chain,omitempty"`
	Line     string `json:"line"`
	Order    int    `json:"order"`
	Reason   string `json:"reason"`
	ReadOnly bool   `json:"readOnly"`
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
}
