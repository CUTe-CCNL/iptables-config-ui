package firewall

import (
	"strings"
	"testing"
)

func TestParseMockRules(t *testing.T) {
	rs, err := ParseRuleset(MockRules())
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	if rs.SnapshotID == "" {
		t.Fatal("expected snapshot id")
	}
	if len(rs.FilterRules) != 5 {
		t.Fatalf("expected 5 supported filter rules, got %d", len(rs.FilterRules))
	}
	if len(rs.NatRules) != 2 {
		t.Fatalf("expected 2 supported nat rules, got %d", len(rs.NatRules))
	}
	if len(rs.RawRules) != 0 {
		t.Fatalf("expected no read-only raw rules, got %d", len(rs.RawRules))
	}
	if rs.NatRules[0].DestinationIP != "10.0.0.20" || rs.NatRules[0].DestinationPort != "443" {
		t.Fatalf("unexpected DNAT destination: %#v", rs.NatRules[0])
	}
}

func TestParseReturnsEmptyArraysForEmptyTables(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	if rs.FilterRules == nil {
		t.Fatal("expected non-nil filter rules slice")
	}
	if rs.NatRules == nil {
		t.Fatal("expected non-nil nat rules slice")
	}
	if rs.RawRules == nil {
		t.Fatal("expected non-nil raw rules slice")
	}
	if rs.Warnings == nil {
		t.Fatal("expected non-nil warnings slice")
	}
}

func TestRenderPreservesReadOnlyRawRules(t *testing.T) {
	rs, err := ParseRuleset(MockRules())
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	rendered, err := RenderRuleset(rs)
	if err != nil {
		t.Fatalf("RenderRuleset: %v", err)
	}
	for _, want := range []string{
		`-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`,
		`-A PREROUTING -p tcp -m tcp --dport 8443 -j DNAT --to-destination 10.0.0.20:443`,
		`-A POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE`,
	} {
		if !strings.Contains(rendered, want) {
			t.Fatalf("rendered rules missing %q:\n%s", want, rendered)
		}
	}
}

func TestValidateRulesetRejectsBadPortForward(t *testing.T) {
	rs, err := ParseRuleset(MockRules())
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	rs.NatRules[0].ListenPort = "70000"
	result := ValidateRuleset(rs)
	if result.Valid {
		t.Fatal("expected invalid ruleset")
	}
	if len(result.Errors) == 0 || !strings.Contains(result.Errors[0], "listen port") {
		t.Fatalf("expected listen port error, got %#v", result.Errors)
	}
}

func TestCustomChainIsStructuredAndEditable(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
:MYCHAIN - [0:0]
-A MYCHAIN -j ACCEPT
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	if result := ValidateRuleset(rs); !result.Valid {
		t.Fatalf("custom chain should validate, got errors %#v", result.Errors)
	}
	if len(rs.RawRules) != 0 {
		t.Fatalf("expected no raw rules for simple custom chain, got %d", len(rs.RawRules))
	}
	if len(rs.FilterRules) != 1 || rs.FilterRules[0].Chain != "MYCHAIN" {
		t.Fatalf("expected MYCHAIN filter rule, got %#v", rs.FilterRules)
	}
	found := false
	for _, policy := range rs.Policies {
		if policy.Table == "filter" && policy.Chain == "MYCHAIN" && policy.Policy == "-" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected MYCHAIN policy declaration, got %#v", rs.Policies)
	}
	rendered, err := RenderRuleset(rs)
	if err != nil {
		t.Fatalf("RenderRuleset: %v", err)
	}
	for _, want := range []string{`:MYCHAIN - [0:0]`, `-A MYCHAIN -j ACCEPT`} {
		if !strings.Contains(rendered, want) {
			t.Fatalf("rendered custom chain missing %q:\n%s", want, rendered)
		}
	}
}

func TestFilterCustomChainJumpIsStructured(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
:MYCHAIN - [0:0]
-A INPUT -j MYCHAIN
-A MYCHAIN -j RETURN
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	if result := ValidateRuleset(rs); !result.Valid {
		t.Fatalf("custom chain jump should validate, got errors %#v", result.Errors)
	}
	if len(rs.FilterRules) != 2 {
		t.Fatalf("expected 2 structured filter rules, got %#v", rs.FilterRules)
	}
	if rs.FilterRules[0].Target != "MYCHAIN" || rs.FilterRules[1].Target != "RETURN" {
		t.Fatalf("unexpected custom chain targets: %#v", rs.FilterRules)
	}
}

func TestNATCustomChainContentsAreStructured(t *testing.T) {
	raw := `*nat
:PREROUTING ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
:MYNAT - [0:0]
-A PREROUTING -j MYNAT
-A MYNAT -p tcp -m tcp --dport 8080 -j DNAT --to-destination 10.0.0.20:80
-A MYNAT -s 10.0.0.0/24 -o eth0 -j MASQUERADE
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	if result := ValidateRuleset(rs); !result.Valid {
		t.Fatalf("custom NAT chain should validate, got errors %#v", result.Errors)
	}
	if len(rs.NatRules) != 3 {
		t.Fatalf("expected 3 structured NAT rules, got %#v", rs.NatRules)
	}
	if rs.NatRules[0].Type != "jump" || rs.NatRules[0].Target != "MYNAT" {
		t.Fatalf("expected structured NAT jump, got %#v", rs.NatRules[0])
	}
	if rs.NatRules[1].Chain != "MYNAT" || rs.NatRules[2].Chain != "MYNAT" {
		t.Fatalf("expected NAT rules in MYNAT, got %#v", rs.NatRules)
	}
	if len(rs.RawRules) != 0 {
		t.Fatalf("expected no raw NAT rules, got %#v", rs.RawRules)
	}
	rendered, err := RenderRuleset(rs)
	if err != nil {
		t.Fatalf("RenderRuleset: %v", err)
	}
	for _, want := range []string{
		`:MYNAT - [0:0]`,
		`-A PREROUTING -j MYNAT`,
		`-A MYNAT -p tcp -m tcp --dport 8080 -j DNAT --to-destination 10.0.0.20:80`,
		`-A MYNAT -s 10.0.0.0/24 -o eth0 -j MASQUERADE`,
	} {
		if !strings.Contains(rendered, want) {
			t.Fatalf("rendered NAT custom chain missing %q:\n%s", want, rendered)
		}
	}
}

func TestValidateRulesetRejectsUndeclaredChainReferences(t *testing.T) {
	rs := Ruleset{
		Policies: ensureDefaultPolicies(nil),
		FilterRules: []Rule{
			{ID: "missing-chain", Table: "filter", Chain: "MISSING", Target: "ACCEPT", Order: 1},
			{ID: "missing-target", Table: "filter", Chain: "INPUT", Target: "MISSING", Order: 2},
		},
		NatRules: []NatRule{
			{
				ID: "missing-nat-chain", Type: "port-forward", Table: "nat", Chain: "MISSING",
				Protocol: "tcp", ListenPort: "8080", DestinationIP: "10.0.0.20", DestinationPort: "80", Order: 1,
			},
		},
	}
	result := ValidateRuleset(rs)
	if result.Valid {
		t.Fatal("expected undeclared chain references to be invalid")
	}
	for _, want := range []string{"filter rule 1 has unsupported chain", "filter rule 2 has unsupported target", "nat rule 1 has unsupported chain"} {
		found := false
		for _, err := range result.Errors {
			if err == want {
				found = true
			}
		}
		if !found {
			t.Fatalf("expected error %q, got %#v", want, result.Errors)
		}
	}
}

func TestParseDoesNotInventMissingNATTable(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
:FORWARD ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	for _, policy := range rs.Policies {
		if policy.Table == "nat" {
			t.Fatalf("did not expect synthetic nat policy: %#v", rs.Policies)
		}
	}
	for _, table := range rs.Tables {
		if table.Name == "nat" {
			t.Fatalf("did not expect synthetic nat table: %#v", rs.Tables)
		}
	}
}

func TestApplyDiagnosticsAddsLineNumbersAndCounters(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
-A INPUT -j ACCEPT
-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	ApplyDiagnostics(&rs, Diagnostics{Commands: []CommandDiagnostic{
		{
			Name: "iptables",
			Args: []string{"-t", "filter", "-L", "-v", "-n", "-x", "--line-numbers"},
			Stdout: `Chain INPUT (policy ACCEPT 7 packets, 700 bytes)
num      pkts      bytes target     prot opt in     out     source               destination
1        11        1100  ACCEPT     all  --  *      *       0.0.0.0/0            0.0.0.0/0
2        22        2200  ACCEPT     all  --  *      *       0.0.0.0/0            0.0.0.0/0
`,
			ExitCode: 0,
		},
	}})
	if rs.FilterRules[0].Position.LineNumber != 1 || rs.FilterRules[0].Counters.Packets != 11 {
		t.Fatalf("first rule metadata not applied: %#v", rs.FilterRules[0])
	}
	if rs.FilterRules[1].Position.LineNumber != 2 || rs.FilterRules[1].Counters.Bytes != 2200 {
		t.Fatalf("second rule metadata not applied: %#v", rs.FilterRules[1])
	}
	if rs.Policies[0].Counters.Packets != 7 || rs.Policies[0].Counters.Bytes != 700 {
		t.Fatalf("policy counters not applied: %#v", rs.Policies[0])
	}
}

func TestParseCommonEditableRules(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
-A INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW,ESTABLISHED -j ACCEPT
-A INPUT -j LOG --log-prefix "drop "
COMMIT
*nat
:PREROUTING ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
-A POSTROUTING -s 10.0.0.0/24 -j SNAT --to-source 203.0.113.10
-A PREROUTING -p tcp --dport 8080 -j REDIRECT --to-ports 80
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	if len(rs.RawRules) != 0 {
		t.Fatalf("expected common rules to be structured, got raw %#v", rs.RawRules)
	}
	if rs.FilterRules[0].DestinationPort != "80,443" || rs.FilterRules[0].State != "NEW,ESTABLISHED" {
		t.Fatalf("multiport/state not parsed: %#v", rs.FilterRules[0])
	}
	if rs.FilterRules[1].Target != "LOG" || rs.FilterRules[1].LogPrefix != "drop " {
		t.Fatalf("LOG rule not parsed: %#v", rs.FilterRules[1])
	}
	if rs.NatRules[0].Type != "snat" || rs.NatRules[0].ToSource != "203.0.113.10" {
		t.Fatalf("SNAT rule not parsed: %#v", rs.NatRules[0])
	}
	if rs.NatRules[1].Type != "redirect" || rs.NatRules[1].ToPorts != "80" {
		t.Fatalf("REDIRECT rule not parsed: %#v", rs.NatRules[1])
	}
}

func TestRenderPreservesUnsupportedTables(t *testing.T) {
	raw := `*filter
:INPUT ACCEPT [0:0]
COMMIT
*mangle
:PREROUTING ACCEPT [0:0]
-A PREROUTING -j MARK --set-xmark 0x1/0xffffffff
COMMIT
`
	rs, err := ParseRuleset(raw)
	if err != nil {
		t.Fatalf("ParseRuleset: %v", err)
	}
	rendered, err := RenderRuleset(rs)
	if err != nil {
		t.Fatalf("RenderRuleset: %v", err)
	}
	if !strings.Contains(rendered, "*mangle") || !strings.Contains(rendered, "--set-xmark") {
		t.Fatalf("unsupported table was not preserved:\n%s", rendered)
	}
}
