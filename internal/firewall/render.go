package firewall

import (
	"errors"
	"sort"
	"strings"
)

func RenderRuleset(rs Ruleset) (string, error) {
	if result := ValidateRuleset(rs); !result.Valid {
		return "", errors.New(strings.Join(result.Errors, "; "))
	}

	var out strings.Builder
	renderTable(&out, "filter", rs)
	renderTable(&out, "nat", rs)
	renderRawOnlyTables(&out, rs.RawRules)
	return out.String(), nil
}

func renderTable(out *strings.Builder, table string, rs Ruleset) {
	if table == "nat" && len(rs.NatRules) == 0 && countRawForTable(rs.RawRules, table) == 0 && countPoliciesForTable(rs.Policies, table) == 0 {
		return
	}

	out.WriteString("*")
	out.WriteString(table)
	out.WriteString("\n")
	for _, policy := range tablePolicies(table, rs.Policies) {
		out.WriteString(":")
		out.WriteString(policy.Chain)
		out.WriteString(" ")
		out.WriteString(policy.Policy)
		out.WriteString(" [0:0]\n")
	}

	entries := tableEntries(table, rs)
	sort.SliceStable(entries, func(i, j int) bool {
		return entries[i].order < entries[j].order
	})
	for _, entry := range entries {
		out.WriteString(entry.line)
		out.WriteString("\n")
	}
	out.WriteString("COMMIT\n")
}

type renderEntry struct {
	order int
	line  string
}

func tableEntries(table string, rs Ruleset) []renderEntry {
	var entries []renderEntry
	for _, rule := range rs.FilterRules {
		if rule.Table == table {
			entries = append(entries, renderEntry{order: rule.Order, line: renderFilterRule(rule)})
		}
	}
	for _, rule := range rs.NatRules {
		if rule.Table == table {
			entries = append(entries, renderEntry{order: rule.Order, line: renderNATRule(rule)})
		}
	}
	for _, rule := range rs.RawRules {
		if rule.Table == table {
			entries = append(entries, renderEntry{order: rule.Order, line: rule.Line})
		}
	}
	return entries
}

func renderFilterRule(r Rule) string {
	var b strings.Builder
	b.WriteString("-A ")
	b.WriteString(r.Chain)
	writeCommonMatch(&b, r.Protocol, r.Source, r.Destination, r.InInterface, r.OutInterface, r.SourcePort, r.DestinationPort)
	writeComment(&b, r.Comment)
	b.WriteString(" -j ")
	b.WriteString(r.Target)
	return b.String()
}

func renderNATRule(r NatRule) string {
	var b strings.Builder
	b.WriteString("-A ")
	b.WriteString(r.Chain)
	if r.Type == "port-forward" {
		writeCommonMatch(&b, r.Protocol, r.SourceCIDR, "", r.InInterface, r.OutInterface, "", r.ListenPort)
		writeComment(&b, r.Comment)
		b.WriteString(" -j DNAT --to-destination ")
		b.WriteString(r.DestinationIP)
		b.WriteString(":")
		b.WriteString(r.DestinationPort)
		return b.String()
	}
	writeCommonMatch(&b, "", r.SourceCIDR, "", "", r.OutInterface, "", "")
	writeComment(&b, r.Comment)
	b.WriteString(" -j MASQUERADE")
	return b.String()
}

func writeCommonMatch(b *strings.Builder, protocol, source, destination, inInterface, outInterface, sourcePort, destinationPort string) {
	if protocol != "" {
		b.WriteString(" -p ")
		b.WriteString(protocol)
		if protocol == "tcp" || protocol == "udp" {
			b.WriteString(" -m ")
			b.WriteString(protocol)
		}
	}
	if source != "" {
		b.WriteString(" -s ")
		b.WriteString(source)
	}
	if destination != "" {
		b.WriteString(" -d ")
		b.WriteString(destination)
	}
	if inInterface != "" {
		b.WriteString(" -i ")
		b.WriteString(inInterface)
	}
	if outInterface != "" {
		b.WriteString(" -o ")
		b.WriteString(outInterface)
	}
	if sourcePort != "" {
		b.WriteString(" --sport ")
		b.WriteString(sourcePort)
	}
	if destinationPort != "" {
		b.WriteString(" --dport ")
		b.WriteString(destinationPort)
	}
}

func writeComment(b *strings.Builder, comment string) {
	if comment == "" {
		return
	}
	b.WriteString(" -m comment --comment ")
	b.WriteString(quoteToken(comment))
}

func quoteToken(v string) string {
	escaped := strings.ReplaceAll(v, `\`, `\\`)
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	return `"` + escaped + `"`
}

func tablePolicies(table string, policies []Policy) []Policy {
	defaults := defaultPolicies(table)
	byChain := map[string]Policy{}
	for _, policy := range defaults {
		byChain[policy.Chain] = policy
	}
	for _, policy := range policies {
		if policy.Table == table {
			byChain[policy.Chain] = policy
		}
	}

	result := make([]Policy, 0, len(byChain))
	for _, policy := range byChain {
		result = append(result, policy)
	}
	sort.SliceStable(result, func(i, j int) bool {
		return policySortKey(result[i]) < policySortKey(result[j])
	})
	return result
}

func ensureDefaultPolicies(policies []Policy) []Policy {
	seen := map[string]bool{}
	for _, p := range policies {
		seen[p.Table+":"+p.Chain] = true
	}
	for _, table := range []string{"filter", "nat"} {
		for _, p := range defaultPolicies(table) {
			if !seen[p.Table+":"+p.Chain] {
				policies = append(policies, p)
			}
		}
	}
	return policies
}

func defaultPolicies(table string) []Policy {
	if table == "filter" {
		return []Policy{
			{Table: "filter", Chain: "INPUT", Policy: "ACCEPT", Order: 1},
			{Table: "filter", Chain: "FORWARD", Policy: "ACCEPT", Order: 2},
			{Table: "filter", Chain: "OUTPUT", Policy: "ACCEPT", Order: 3},
		}
	}
	if table == "nat" {
		return []Policy{
			{Table: "nat", Chain: "PREROUTING", Policy: "ACCEPT", Order: 1},
			{Table: "nat", Chain: "INPUT", Policy: "ACCEPT", Order: 2},
			{Table: "nat", Chain: "OUTPUT", Policy: "ACCEPT", Order: 3},
			{Table: "nat", Chain: "POSTROUTING", Policy: "ACCEPT", Order: 4},
		}
	}
	return nil
}

func policySortKey(policy Policy) int {
	keys := map[string]int{
		"filter:INPUT":    10,
		"filter:FORWARD":  20,
		"filter:OUTPUT":   30,
		"nat:PREROUTING":  10,
		"nat:INPUT":       20,
		"nat:OUTPUT":      30,
		"nat:POSTROUTING": 40,
	}
	if v, ok := keys[policy.Table+":"+policy.Chain]; ok {
		return v
	}
	return 100 + policy.Order
}

func countRawForTable(rules []RawRule, table string) int {
	count := 0
	for _, rule := range rules {
		if rule.Table == table {
			count++
		}
	}
	return count
}

func countPoliciesForTable(policies []Policy, table string) int {
	count := 0
	for _, policy := range policies {
		if policy.Table == table {
			count++
		}
	}
	return count
}

func renderRawOnlyTables(out *strings.Builder, rawRules []RawRule) {
	byTable := map[string][]RawRule{}
	for _, rule := range rawRules {
		if rule.Table == "filter" || rule.Table == "nat" {
			continue
		}
		byTable[rule.Table] = append(byTable[rule.Table], rule)
	}

	tables := make([]string, 0, len(byTable))
	for table := range byTable {
		tables = append(tables, table)
	}
	sort.Strings(tables)

	for _, table := range tables {
		rules := byTable[table]
		sort.SliceStable(rules, func(i, j int) bool {
			return rules[i].Order < rules[j].Order
		})
		out.WriteString("*")
		out.WriteString(table)
		out.WriteString("\n")
		for _, rule := range rules {
			out.WriteString(rule.Line)
			out.WriteString("\n")
		}
		out.WriteString("COMMIT\n")
	}
}
