package firewall

import (
	"fmt"
	"net/netip"
	"regexp"
	"strconv"
	"strings"
)

var interfaceNameRE = regexp.MustCompile(`^[A-Za-z0-9_.:+-]{1,32}$`)
var chainNameRE = regexp.MustCompile(`^[A-Za-z0-9_.:+-]{1,32}$`)

type chainSet map[string]map[string]bool

func ValidateRuleset(rs Ruleset) ValidationResult {
	var errors []string
	chains := declaredChainSet(rs.Policies)
	for i, policy := range rs.Policies {
		if !supportedTable(policy.Table) || !validChainName(policy.Chain) {
			errors = append(errors, fmt.Sprintf("policy %d has unsupported chain %s/%s", i+1, policy.Table, policy.Chain))
			continue
		}
		if allowedChain(policy.Table, policy.Chain) {
			if !allowedPolicy(policy.Policy) {
				errors = append(errors, fmt.Sprintf("policy %d has unsupported policy %q", i+1, policy.Policy))
			}
		} else if policy.Policy != "-" {
			errors = append(errors, fmt.Sprintf("policy %d custom chain must use policy \"-\"", i+1))
		}
	}
	for i, rule := range rs.FilterRules {
		prefix := fmt.Sprintf("filter rule %d", i+1)
		errors = append(errors, validateFilterRule(prefix, rule, chains["filter"])...)
	}
	for i, rule := range rs.NatRules {
		prefix := fmt.Sprintf("nat rule %d", i+1)
		errors = append(errors, validateNATRule(prefix, rule, chains["nat"])...)
	}
	return ValidationResult{Valid: len(errors) == 0, Errors: errors}
}

func validateFilterRule(prefix string, r Rule, chains map[string]bool) []string {
	var errors []string
	if r.Table != "filter" {
		errors = append(errors, prefix+" must be in filter table")
	}
	if !chainExists(chains, r.Chain) {
		errors = append(errors, prefix+" has unsupported chain")
	}
	if !allowedFilterTarget(r.Target, chains) {
		errors = append(errors, prefix+" has unsupported target")
	}
	if !allowedProtocol(r.Protocol, true) {
		errors = append(errors, prefix+" has unsupported protocol")
	}
	if r.Source != "" && !validCIDROrIP(r.Source) {
		errors = append(errors, prefix+" has invalid source")
	}
	if r.Destination != "" && !validCIDROrIP(r.Destination) {
		errors = append(errors, prefix+" has invalid destination")
	}
	if r.SourcePort != "" && !validPort(r.SourcePort) {
		errors = append(errors, prefix+" has invalid source port")
	}
	if r.DestinationPort != "" && !validPort(r.DestinationPort) {
		errors = append(errors, prefix+" has invalid destination port")
	}
	if (r.SourcePort != "" || r.DestinationPort != "") && r.Protocol != "tcp" && r.Protocol != "udp" {
		errors = append(errors, prefix+" uses ports without tcp/udp protocol")
	}
	if r.InInterface != "" && !validInterface(r.InInterface) {
		errors = append(errors, prefix+" has invalid input interface")
	}
	if r.OutInterface != "" && !validInterface(r.OutInterface) {
		errors = append(errors, prefix+" has invalid output interface")
	}
	if len(r.Extra) > 0 {
		errors = append(errors, prefix+" has unsupported extra arguments")
	}
	return errors
}

func validateNATRule(prefix string, r NatRule, chains map[string]bool) []string {
	var errors []string
	if r.Table != "nat" {
		errors = append(errors, prefix+" must be in nat table")
	}
	if !chainExists(chains, r.Chain) {
		errors = append(errors, prefix+" has unsupported chain")
	}
	switch r.Type {
	case "port-forward":
		if !allowedProtocol(r.Protocol, false) || (r.Protocol != "tcp" && r.Protocol != "udp") {
			errors = append(errors, prefix+" port-forward protocol must be tcp or udp")
		}
		if !validPort(r.ListenPort) {
			errors = append(errors, prefix+" has invalid listen port")
		}
		if !validPort(r.DestinationPort) {
			errors = append(errors, prefix+" has invalid destination port")
		}
		if !validIP(r.DestinationIP) {
			errors = append(errors, prefix+" has invalid destination IP")
		}
	case "masquerade":
	default:
		errors = append(errors, prefix+" has unsupported NAT type")
	}
	if r.SourceCIDR != "" && !validCIDROrIP(r.SourceCIDR) {
		errors = append(errors, prefix+" has invalid source CIDR")
	}
	if r.InInterface != "" && !validInterface(r.InInterface) {
		errors = append(errors, prefix+" has invalid input interface")
	}
	if r.OutInterface != "" && !validInterface(r.OutInterface) {
		errors = append(errors, prefix+" has invalid output interface")
	}
	if len(r.Extra) > 0 {
		errors = append(errors, prefix+" has unsupported extra arguments")
	}
	return errors
}

func isSupportedFilterRule(r Rule, chains map[string]bool) bool {
	return len(validateFilterRule("rule", r, chains)) == 0
}

func isSupportedPortForward(r NatRule, chains map[string]bool) bool {
	return len(validateNATRule("rule", r, chains)) == 0
}

func allowedPolicy(v string) bool {
	switch strings.ToUpper(v) {
	case "ACCEPT", "DROP":
		return true
	default:
		return false
	}
}

func allowedFilterTarget(v string, chains map[string]bool) bool {
	switch strings.ToUpper(v) {
	case "ACCEPT", "DROP", "REJECT", "RETURN":
		return true
	default:
		return chainExists(chains, v)
	}
}

func allowedChain(table, chain string) bool {
	if table == "filter" {
		switch chain {
		case "INPUT", "OUTPUT", "FORWARD":
			return true
		}
	}
	if table == "nat" {
		switch chain {
		case "PREROUTING", "INPUT", "OUTPUT", "POSTROUTING":
			return true
		}
	}
	return false
}

func supportedTable(table string) bool {
	return table == "filter" || table == "nat"
}

func defaultChainSet() chainSet {
	chains := chainSet{}
	for _, table := range []string{"filter", "nat"} {
		chains[table] = map[string]bool{}
		for _, policy := range defaultPolicies(table) {
			chains[table][policy.Chain] = true
		}
	}
	return chains
}

func declaredChainSet(policies []Policy) chainSet {
	chains := defaultChainSet()
	for _, policy := range policies {
		chains.add(policy.Table, policy.Chain)
	}
	return chains
}

func (chains chainSet) add(table, chain string) {
	if !supportedTable(table) || !validChainName(chain) {
		return
	}
	if chains[table] == nil {
		chains[table] = map[string]bool{}
	}
	chains[table][chain] = true
}

func chainExists(chains map[string]bool, chain string) bool {
	return validChainName(chain) && chains[chain]
}

func validChainName(v string) bool {
	return chainNameRE.MatchString(v)
}

func allowedProtocol(v string, allowEmpty bool) bool {
	v = strings.ToLower(v)
	if v == "" {
		return allowEmpty
	}
	switch v {
	case "tcp", "udp", "icmp":
		return true
	default:
		return false
	}
}

func validCIDROrIP(v string) bool {
	if _, err := netip.ParseAddr(v); err == nil {
		return true
	}
	if _, err := netip.ParsePrefix(v); err == nil {
		return true
	}
	return false
}

func validIP(v string) bool {
	_, err := netip.ParseAddr(v)
	return err == nil
}

func validPort(v string) bool {
	n, err := strconv.Atoi(v)
	return err == nil && n >= 1 && n <= 65535
}

func validInterface(v string) bool {
	return interfaceNameRE.MatchString(v)
}
