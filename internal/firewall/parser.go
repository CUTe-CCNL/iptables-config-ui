package firewall

import (
	"fmt"
	"strconv"
	"strings"
)

func ParseRuleset(raw string) (Ruleset, error) {
	rs := Ruleset{
		SnapshotID: SnapshotID(raw),
		Raw:        raw,
	}

	var table string
	order := 0
	for lineNo, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "*") {
			table = strings.TrimPrefix(line, "*")
			order = 0
			continue
		}
		if line == "COMMIT" {
			table = ""
			continue
		}
		if table == "" {
			rs.Warnings = append(rs.Warnings, fmt.Sprintf("line %d ignored outside table", lineNo+1))
			continue
		}
		order++

		if strings.HasPrefix(line, ":") {
			policy, ok := parsePolicy(table, line, order)
			if ok {
				rs.Policies = append(rs.Policies, policy)
			} else {
				rs.RawRules = append(rs.RawRules, rawRule(table, "", line, order, "unsupported policy line"))
			}
			continue
		}

		if !strings.HasPrefix(line, "-A ") {
			rs.RawRules = append(rs.RawRules, rawRule(table, "", line, order, "unsupported iptables-save directive"))
			continue
		}

		parsed, err := parseAppendLine(table, line, order)
		if err != nil {
			rs.RawRules = append(rs.RawRules, rawRule(table, "", line, order, err.Error()))
			continue
		}
		switch v := parsed.(type) {
		case Rule:
			rs.FilterRules = append(rs.FilterRules, v)
		case NatRule:
			rs.NatRules = append(rs.NatRules, v)
		case RawRule:
			rs.RawRules = append(rs.RawRules, v)
		}
	}

	rs.Policies = ensureDefaultPolicies(rs.Policies)
	rs.Normalize()
	return rs, nil
}

func parsePolicy(table, line string, order int) (Policy, bool) {
	body := strings.TrimPrefix(line, ":")
	parts := strings.Fields(body)
	if len(parts) < 2 {
		return Policy{}, false
	}
	if !allowedChain(table, parts[0]) || !allowedPolicy(parts[1]) {
		return Policy{}, false
	}
	return Policy{Table: table, Chain: parts[0], Policy: parts[1], Order: order}, true
}

func parseAppendLine(table, line string, order int) (any, error) {
	tokens, err := splitTokens(line)
	if err != nil {
		return nil, err
	}
	if len(tokens) < 3 || tokens[0] != "-A" {
		return nil, fmt.Errorf("unsupported append line")
	}

	fields := parsedFields{
		table: table,
		chain: tokens[1],
		order: order,
		line:  line,
	}
	for i := 2; i < len(tokens); i++ {
		switch tokens[i] {
		case "-p":
			i = takeValue(tokens, i, &fields.protocol)
		case "-s":
			i = takeValue(tokens, i, &fields.source)
		case "-d":
			i = takeValue(tokens, i, &fields.destination)
		case "-i":
			i = takeValue(tokens, i, &fields.inInterface)
		case "-o":
			i = takeValue(tokens, i, &fields.outInterface)
		case "-j":
			i = takeValue(tokens, i, &fields.target)
		case "--dport", "--destination-port":
			i = takeValue(tokens, i, &fields.destinationPort)
		case "--sport", "--source-port":
			i = takeValue(tokens, i, &fields.sourcePort)
		case "--to-destination":
			i = takeValue(tokens, i, &fields.toDestination)
		case "--comment":
			i = takeValue(tokens, i, &fields.comment)
		case "-m":
			if i+1 < len(tokens) {
				fields.modules = append(fields.modules, tokens[i+1])
				i++
			} else {
				fields.extra = append(fields.extra, tokens[i])
			}
		default:
			fields.extra = append(fields.extra, tokens[i])
		}
	}

	if table == "filter" {
		return fields.toFilterRule(), nil
	}
	if table == "nat" {
		return fields.toNATRule(), nil
	}
	return rawRule(table, fields.chain, line, order, "unsupported table"), nil
}

type parsedFields struct {
	table           string
	chain           string
	order           int
	line            string
	protocol        string
	source          string
	destination     string
	inInterface     string
	outInterface    string
	target          string
	sourcePort      string
	destinationPort string
	toDestination   string
	comment         string
	modules         []string
	extra           []string
}

func (f parsedFields) toFilterRule() any {
	r := Rule{
		ID:              ruleID("filter", f.chain, f.order, f.line),
		Table:           "filter",
		Chain:           f.chain,
		Target:          f.target,
		Protocol:        normalizeAll(f.protocol),
		Source:          f.source,
		Destination:     f.destination,
		InInterface:     f.inInterface,
		OutInterface:    f.outInterface,
		SourcePort:      f.sourcePort,
		DestinationPort: f.destinationPort,
		Comment:         f.comment,
		Order:           f.order,
		Extra:           append([]string(nil), f.extra...),
	}
	if !isSupportedFilterRule(r) {
		return rawRule(f.table, f.chain, f.line, f.order, "unsupported filter rule")
	}
	return r
}

func (f parsedFields) toNATRule() any {
	if f.target == "DNAT" && f.chain == "PREROUTING" {
		ip, port := splitDestination(f.toDestination)
		r := NatRule{
			ID:              ruleID("nat", f.chain, f.order, f.line),
			Type:            "port-forward",
			Table:           "nat",
			Chain:           f.chain,
			Protocol:        normalizeAll(f.protocol),
			ListenPort:      f.destinationPort,
			DestinationIP:   ip,
			DestinationPort: port,
			SourceCIDR:      f.source,
			InInterface:     f.inInterface,
			OutInterface:    f.outInterface,
			Comment:         f.comment,
			Target:          f.target,
			ToDestination:   f.toDestination,
			Order:           f.order,
			Extra:           append([]string(nil), f.extra...),
		}
		if isSupportedPortForward(r) {
			return r
		}
	}
	if f.target == "MASQUERADE" && f.chain == "POSTROUTING" {
		r := NatRule{
			ID:           ruleID("nat", f.chain, f.order, f.line),
			Type:         "masquerade",
			Table:        "nat",
			Chain:        f.chain,
			SourceCIDR:   f.source,
			OutInterface: f.outInterface,
			Comment:      f.comment,
			Target:       f.target,
			Order:        f.order,
			Extra:        append([]string(nil), f.extra...),
		}
		if len(r.Extra) == 0 {
			return r
		}
	}
	return rawRule(f.table, f.chain, f.line, f.order, "unsupported NAT rule")
}

func splitTokens(line string) ([]string, error) {
	var tokens []string
	var b strings.Builder
	var quote rune
	escaped := false

	flush := func() {
		if b.Len() > 0 {
			tokens = append(tokens, b.String())
			b.Reset()
		}
	}

	for _, r := range line {
		switch {
		case escaped:
			b.WriteRune(r)
			escaped = false
		case r == '\\':
			escaped = true
		case quote != 0:
			if r == quote {
				quote = 0
			} else {
				b.WriteRune(r)
			}
		case r == '\'' || r == '"':
			quote = r
		case r == ' ' || r == '\t':
			flush()
		default:
			b.WriteRune(r)
		}
	}
	if quote != 0 {
		return nil, fmt.Errorf("unterminated quote")
	}
	if escaped {
		b.WriteRune('\\')
	}
	flush()
	return tokens, nil
}

func takeValue(tokens []string, i int, out *string) int {
	if i+1 < len(tokens) {
		*out = tokens[i+1]
		return i + 1
	}
	return i
}

func rawRule(table, chain, line string, order int, reason string) RawRule {
	return RawRule{
		ID:       ruleID(table, chain, order, line),
		Table:    table,
		Chain:    chain,
		Line:     line,
		Order:    order,
		Reason:   reason,
		ReadOnly: true,
	}
}

func ruleID(table, chain string, order int, line string) string {
	return table + "-" + chain + "-" + strconv.Itoa(order) + "-" + SnapshotID(line)
}

func normalizeAll(v string) string {
	if v == "all" {
		return ""
	}
	return strings.ToLower(v)
}

func splitDestination(v string) (string, string) {
	host, port, ok := strings.Cut(v, ":")
	if !ok {
		return v, ""
	}
	return host, port
}
