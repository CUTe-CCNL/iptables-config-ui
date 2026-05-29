package firewall

import (
	"fmt"
	"strconv"
	"strings"
)

func ParseRuleset(raw string) (Ruleset, error) {
	rs := Ruleset{
		SnapshotID: rulesetSnapshotID(raw),
		Raw:        raw,
	}

	var table string
	declaredChains := defaultChainSet()
	order := 0
	for lineNo, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "*") {
			table = strings.TrimPrefix(line, "*")
			rs.ensureTableInfo(table)
			if declaredChains[table] == nil {
				declaredChains[table] = map[string]bool{}
			}
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
		tableOrder := rs.tableOrder(table)
		position := RulePosition{TableOrder: tableOrder, SaveOrder: order}

		if strings.HasPrefix(line, ":") {
			policy, ok := parsePolicy(table, line, order)
			if ok {
				chainOrder := rs.ensureChainInfo(table, policy.Chain, policy.Policy, policy.Counters)
				position.ChainOrder = chainOrder
				policy.Position = position
				rs.Policies = append(rs.Policies, policy)
				declaredChains.add(policy.Table, policy.Chain)
			} else {
				rs.RawRules = append(rs.RawRules, rawRuleWithPosition(table, "", line, order, "unsupported policy line", position))
			}
			continue
		}

		if !strings.HasPrefix(line, "-A ") {
			rs.RawRules = append(rs.RawRules, rawRuleWithPosition(table, "", line, order, "unsupported iptables-save directive", position))
			continue
		}

		parsed, err := parseAppendLine(table, line, order, position, declaredChains[table])
		if err != nil {
			chain := appendLineChain(line)
			if chain != "" {
				position.ChainOrder = rs.ensureChainInfo(table, chain, "", Counters{})
			}
			rs.RawRules = append(rs.RawRules, rawRuleWithPosition(table, chain, line, order, err.Error(), position))
			continue
		}
		switch v := parsed.(type) {
		case Rule:
			v.Position.ChainOrder = rs.ensureChainInfo(table, v.Chain, "", Counters{})
			rs.FilterRules = append(rs.FilterRules, v)
		case NatRule:
			v.Position.ChainOrder = rs.ensureChainInfo(table, v.Chain, "", Counters{})
			rs.NatRules = append(rs.NatRules, v)
		case RawRule:
			if v.Chain != "" {
				v.Position.ChainOrder = rs.ensureChainInfo(table, v.Chain, "", Counters{})
			}
			rs.RawRules = append(rs.RawRules, v)
		}
	}

	rs.Normalize()
	return rs, nil
}

func parsePolicy(table, line string, order int) (Policy, bool) {
	if !supportedTable(table) {
		return Policy{}, false
	}
	body := strings.TrimPrefix(line, ":")
	parts := strings.Fields(body)
	if len(parts) < 2 {
		return Policy{}, false
	}
	chain := parts[0]
	policy := strings.ToUpper(parts[1])
	if !validChainName(chain) {
		return Policy{}, false
	}
	if allowedChain(table, chain) {
		if !allowedPolicy(policy) {
			return Policy{}, false
		}
	} else if policy != "-" {
		return Policy{}, false
	}
	return Policy{Table: table, Chain: chain, Policy: policy, Order: order, Counters: parsePolicyCounters(parts)}, true
}

func parseAppendLine(table, line string, order int, position RulePosition, chains map[string]bool) (any, error) {
	tokens, err := splitTokens(line)
	if err != nil {
		return nil, err
	}
	if len(tokens) < 3 || tokens[0] != "-A" {
		return nil, fmt.Errorf("unsupported append line")
	}

	fields := parsedFields{
		table:    table,
		chain:    tokens[1],
		order:    order,
		line:     line,
		position: position,
		chains:   chains,
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
		case "-j", "--jump", "-g", "--goto":
			i = takeValue(tokens, i, &fields.target)
		case "--dport", "--destination-port":
			i = takeValue(tokens, i, &fields.destinationPort)
		case "--sport", "--source-port":
			i = takeValue(tokens, i, &fields.sourcePort)
		case "--dports", "--destination-ports":
			i = takeValue(tokens, i, &fields.destinationPort)
		case "--sports", "--source-ports":
			i = takeValue(tokens, i, &fields.sourcePort)
		case "--state", "--ctstate":
			i = takeValue(tokens, i, &fields.state)
		case "--to-destination":
			i = takeValue(tokens, i, &fields.toDestination)
		case "--to-source":
			i = takeValue(tokens, i, &fields.toSource)
		case "--to-ports":
			i = takeValue(tokens, i, &fields.toPorts)
		case "--reject-with":
			i = takeValue(tokens, i, &fields.rejectWith)
		case "--log-prefix":
			i = takeValue(tokens, i, &fields.logPrefix)
		case "--log-level":
			i = takeValue(tokens, i, &fields.logLevel)
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
	position        RulePosition
	chains          map[string]bool
	protocol        string
	source          string
	destination     string
	inInterface     string
	outInterface    string
	target          string
	sourcePort      string
	destinationPort string
	state           string
	toDestination   string
	toSource        string
	toPorts         string
	rejectWith      string
	logPrefix       string
	logLevel        string
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
		State:           f.state,
		RejectWith:      f.rejectWith,
		LogPrefix:       f.logPrefix,
		LogLevel:        f.logLevel,
		Comment:         f.comment,
		Order:           f.order,
		Extra:           append([]string(nil), f.extra...),
		Position:        f.position,
		SourceLine:      f.line,
	}
	if !isSupportedFilterRule(r, f.chains) {
		return rawRuleWithPosition(f.table, f.chain, f.line, f.order, "unsupported filter rule", f.position)
	}
	return r
}

func (f parsedFields) toNATRule() any {
	if f.target == "DNAT" {
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
			DestinationCIDR: f.destination,
			InInterface:     f.inInterface,
			OutInterface:    f.outInterface,
			Comment:         f.comment,
			Target:          f.target,
			ToDestination:   f.toDestination,
			Order:           f.order,
			Extra:           append([]string(nil), f.extra...),
			Position:        f.position,
			SourceLine:      f.line,
		}
		if isSupportedPortForward(r, f.chains) {
			return r
		}
	}
	if f.target == "MASQUERADE" {
		r := NatRule{
			ID:              ruleID("nat", f.chain, f.order, f.line),
			Type:            "masquerade",
			Table:           "nat",
			Chain:           f.chain,
			SourceCIDR:      f.source,
			DestinationCIDR: f.destination,
			OutInterface:    f.outInterface,
			Comment:         f.comment,
			Target:          f.target,
			ToPorts:         f.toPorts,
			Order:           f.order,
			Extra:           append([]string(nil), f.extra...),
			Position:        f.position,
			SourceLine:      f.line,
		}
		if isSupportedPortForward(r, f.chains) {
			return r
		}
	}
	if f.target == "SNAT" {
		r := NatRule{
			ID:              ruleID("nat", f.chain, f.order, f.line),
			Type:            "snat",
			Table:           "nat",
			Chain:           f.chain,
			Protocol:        normalizeAll(f.protocol),
			SourceCIDR:      f.source,
			DestinationCIDR: f.destination,
			InInterface:     f.inInterface,
			OutInterface:    f.outInterface,
			Comment:         f.comment,
			Target:          f.target,
			ToSource:        f.toSource,
			Order:           f.order,
			Extra:           append([]string(nil), f.extra...),
			Position:        f.position,
			SourceLine:      f.line,
		}
		if isSupportedPortForward(r, f.chains) {
			return r
		}
	}
	if f.target == "REDIRECT" {
		r := NatRule{
			ID:              ruleID("nat", f.chain, f.order, f.line),
			Type:            "redirect",
			Table:           "nat",
			Chain:           f.chain,
			Protocol:        normalizeAll(f.protocol),
			ListenPort:      f.destinationPort,
			SourceCIDR:      f.source,
			DestinationCIDR: f.destination,
			InInterface:     f.inInterface,
			OutInterface:    f.outInterface,
			Comment:         f.comment,
			Target:          f.target,
			ToPorts:         f.toPorts,
			Order:           f.order,
			Extra:           append([]string(nil), f.extra...),
			Position:        f.position,
			SourceLine:      f.line,
		}
		if isSupportedPortForward(r, f.chains) {
			return r
		}
	}
	if f.target == "RETURN" || chainExists(f.chains, f.target) {
		r := NatRule{
			ID:              ruleID("nat", f.chain, f.order, f.line),
			Type:            "jump",
			Table:           "nat",
			Chain:           f.chain,
			Protocol:        normalizeAll(f.protocol),
			ListenPort:      f.destinationPort,
			SourceCIDR:      f.source,
			DestinationCIDR: f.destination,
			InInterface:     f.inInterface,
			OutInterface:    f.outInterface,
			Comment:         f.comment,
			Target:          f.target,
			Order:           f.order,
			Extra:           append([]string(nil), f.extra...),
			Position:        f.position,
			SourceLine:      f.line,
		}
		if isSupportedPortForward(r, f.chains) {
			return r
		}
	}
	return rawRuleWithPosition(f.table, f.chain, f.line, f.order, "unsupported NAT rule", f.position)
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
	return rawRuleWithPosition(table, chain, line, order, reason, RulePosition{SaveOrder: order})
}

func rawRuleWithPosition(table, chain, line string, order int, reason string, position RulePosition) RawRule {
	return RawRule{
		ID:       ruleID(table, chain, order, line),
		Table:    table,
		Chain:    chain,
		Line:     line,
		Order:    order,
		Reason:   reason,
		ReadOnly: true,
		Position: position,
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

func parsePolicyCounters(parts []string) Counters {
	if len(parts) < 3 {
		return Counters{}
	}
	token := strings.Trim(parts[2], "[]")
	packets, bytes, ok := strings.Cut(token, ":")
	if !ok {
		return Counters{}
	}
	packetCount, errPackets := strconv.ParseUint(packets, 10, 64)
	byteCount, errBytes := strconv.ParseUint(bytes, 10, 64)
	if errPackets != nil || errBytes != nil {
		return Counters{}
	}
	return Counters{Packets: packetCount, Bytes: byteCount}
}

func appendLineChain(line string) string {
	tokens, err := splitTokens(line)
	if err != nil || len(tokens) < 2 || tokens[0] != "-A" {
		return ""
	}
	return tokens[1]
}

func (rs *Ruleset) ensureTableInfo(table string) int {
	if table == "" {
		return 0
	}
	for i := range rs.Tables {
		if rs.Tables[i].Name == table {
			rs.Tables[i].Present = true
			if rs.Tables[i].Order == 0 {
				rs.Tables[i].Order = i + 1
			}
			return rs.Tables[i].Order
		}
	}
	order := len(rs.Tables) + 1
	rs.Tables = append(rs.Tables, TableInfo{Name: table, Order: order, Present: true, Chains: []ChainInfo{}})
	return order
}

func (rs *Ruleset) tableOrder(table string) int {
	for _, info := range rs.Tables {
		if info.Name == table {
			return info.Order
		}
	}
	return rs.ensureTableInfo(table)
}

func (rs *Ruleset) ensureChainInfo(table, chain, policy string, counters Counters) int {
	if table == "" || chain == "" {
		return 0
	}
	rs.ensureTableInfo(table)
	for tableIndex := range rs.Tables {
		if rs.Tables[tableIndex].Name != table {
			continue
		}
		for chainIndex := range rs.Tables[tableIndex].Chains {
			if rs.Tables[tableIndex].Chains[chainIndex].Name == chain {
				if policy != "" {
					rs.Tables[tableIndex].Chains[chainIndex].Policy = policy
				}
				if counters != (Counters{}) {
					rs.Tables[tableIndex].Chains[chainIndex].Counters = counters
				}
				return rs.Tables[tableIndex].Chains[chainIndex].Order
			}
		}
		order := len(rs.Tables[tableIndex].Chains) + 1
		rs.Tables[tableIndex].Chains = append(rs.Tables[tableIndex].Chains, ChainInfo{
			Table:    table,
			Name:     chain,
			Policy:   policy,
			BuiltIn:  allowedChain(table, chain),
			Order:    order,
			Counters: counters,
		})
		return order
	}
	return 0
}
