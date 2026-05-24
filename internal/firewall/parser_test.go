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
	if len(rs.FilterRules) != 4 {
		t.Fatalf("expected 4 supported filter rules, got %d", len(rs.FilterRules))
	}
	if len(rs.NatRules) != 2 {
		t.Fatalf("expected 2 supported nat rules, got %d", len(rs.NatRules))
	}
	if len(rs.RawRules) != 1 {
		t.Fatalf("expected 1 read-only raw rule, got %d", len(rs.RawRules))
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
		`-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT`,
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

func TestCustomChainIsReadOnlyInsteadOfInvalidPolicy(t *testing.T) {
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
		t.Fatalf("custom chain should remain raw/read-only, got errors %#v", result.Errors)
	}
	if len(rs.RawRules) != 2 {
		t.Fatalf("expected custom chain policy and append as raw rules, got %d", len(rs.RawRules))
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
