package firewall

import (
	"fmt"
	"net/netip"
	"regexp"
	"strconv"
	"strings"
)

var interfaceNameRE = regexp.MustCompile(`^[A-Za-z0-9_.:+-]{1,32}$`)

func ValidateRuleset(rs Ruleset) ValidationResult {
	var errors []string
	for i, policy := range rs.Policies {
		if !allowedPolicy(policy.Policy) {
			errors = append(errors, fmt.Sprintf("policy %d has unsupported policy %q", i+1, policy.Policy))
		}
		if !allowedChain(policy.Table, policy.Chain) {
			errors = append(errors, fmt.Sprintf("policy %d has unsupported chain %s/%s", i+1, policy.Table, policy.Chain))
		}
	}
	for i, rule := range rs.FilterRules {
		prefix := fmt.Sprintf("filter rule %d", i+1)
		errors = append(errors, validateFilterRule(prefix, rule)...)
	}
	for i, rule := range rs.NatRules {
		prefix := fmt.Sprintf("nat rule %d", i+1)
		errors = append(errors, validateNATRule(prefix, rule)...)
	}
	return ValidationResult{Valid: len(errors) == 0, Errors: errors}
}

func validateFilterRule(prefix string, r Rule) []string {
	var errors []string
	if r.Table != "filter" {
		errors = append(errors, prefix+" must be in filter table")
	}
	if !allowedChain("filter", r.Chain) {
		errors = append(errors, prefix+" has unsupported chain")
	}
	if !allowedFilterTarget(r.Target) {
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

func validateNATRule(prefix string, r NatRule) []string {
	var errors []string
	if r.Table != "nat" {
		errors = append(errors, prefix+" must be in nat table")
	}
	switch r.Type {
	case "port-forward":
		if r.Chain != "PREROUTING" {
			errors = append(errors, prefix+" port-forward must use PREROUTING")
		}
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
		if r.Chain != "POSTROUTING" {
			errors = append(errors, prefix+" masquerade must use POSTROUTING")
		}
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

func isSupportedFilterRule(r Rule) bool {
	return len(validateFilterRule("rule", r)) == 0
}

func isSupportedPortForward(r NatRule) bool {
	return len(validateNATRule("rule", r)) == 0
}

func allowedPolicy(v string) bool {
	switch strings.ToUpper(v) {
	case "ACCEPT", "DROP":
		return true
	default:
		return false
	}
}

func allowedFilterTarget(v string) bool {
	switch strings.ToUpper(v) {
	case "ACCEPT", "DROP", "REJECT":
		return true
	default:
		return false
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
