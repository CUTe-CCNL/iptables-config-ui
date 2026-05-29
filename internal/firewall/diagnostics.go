package firewall

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

type DiagnosticsRunner interface {
	Diagnostics(context.Context, string) Diagnostics
}

func (r *ExecRunner) Diagnostics(ctx context.Context, raw string) Diagnostics {
	commands := []CommandDiagnostic{
		{
			Name:     "iptables-save",
			Stdout:   raw,
			ExitCode: 0,
		},
	}

	if r.iptables == "" {
		for _, args := range diagnosticIptablesArgs(raw) {
			commands = append(commands, unavailableDiagnostic("iptables", args))
		}
		return Diagnostics{Commands: commands}
	}

	commands = append(commands, runDiagnosticCommand(ctx, r.iptables, "iptables", []string{"--version"}))
	for _, args := range diagnosticIptablesArgs(raw) {
		commands = append(commands, runDiagnosticCommand(ctx, r.iptables, "iptables", args))
	}
	return Diagnostics{Commands: commands}
}

func (r *MockRunner) Diagnostics(_ context.Context, raw string) Diagnostics {
	commands := []CommandDiagnostic{
		{Name: "iptables", Args: []string{"--version"}, Stdout: "iptables v1.8.0 (mock)\n", ExitCode: 0},
		{Name: "iptables-save", Stdout: raw, ExitCode: 0},
	}
	for _, table := range diagnosticTables(raw) {
		commands = append(commands,
			CommandDiagnostic{Name: "iptables", Args: []string{"-t", table, "-S"}, Stdout: mockSaveCommands(raw, table), ExitCode: 0},
			CommandDiagnostic{Name: "iptables", Args: []string{"-t", table, "-L", "-v", "-n", "-x", "--line-numbers"}, Stdout: mockListOutput(raw, table), ExitCode: 0},
		)
	}
	return Diagnostics{Commands: commands}
}

func runDiagnosticCommand(ctx context.Context, path, name string, args []string) CommandDiagnostic {
	start := time.Now()
	cmd := exec.CommandContext(ctx, path, args...)
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()

	result := CommandDiagnostic{
		Name:       name,
		Args:       append([]string(nil), args...),
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		ExitCode:   0,
		DurationMs: time.Since(start).Milliseconds(),
	}
	if err != nil {
		result.ExitCode = 1
		result.Error = err.Error()
		var exitErr *exec.ExitError
		if errors.As(err, &exitErr) {
			result.ExitCode = exitErr.ExitCode()
		}
	}
	return result
}

func unavailableDiagnostic(name string, args []string) CommandDiagnostic {
	return CommandDiagnostic{
		Name:     name,
		Args:     append([]string(nil), args...),
		ExitCode: -1,
		Error:    ErrCommandsUnavailable.Error(),
	}
}

func diagnosticIptablesArgs(raw string) [][]string {
	var args [][]string
	for _, table := range diagnosticTables(raw) {
		args = append(args,
			[]string{"-t", table, "-S"},
			[]string{"-t", table, "-L", "-v", "-n", "-x", "--line-numbers"},
		)
	}
	return args
}

func diagnosticTables(raw string) []string {
	seen := map[string]bool{}
	var tables []string
	add := func(table string) {
		if table == "" || seen[table] {
			return
		}
		seen[table] = true
		tables = append(tables, table)
	}

	for _, table := range []string{"filter", "nat"} {
		add(table)
	}
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "*") {
			add(strings.TrimPrefix(line, "*"))
		}
	}
	return tables
}

func mockSaveCommands(raw, table string) string {
	var out strings.Builder
	inTable := false
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "*"+table {
			inTable = true
			continue
		}
		if line == "COMMIT" && inTable {
			break
		}
		if inTable && line != "" {
			out.WriteString(line)
			out.WriteByte('\n')
		}
	}
	return out.String()
}

func mockListOutput(raw, table string) string {
	rs, err := ParseRuleset(raw)
	if err != nil {
		return ""
	}

	var out strings.Builder
	chains := tableChains(rs, table)
	for _, chain := range chains {
		if chain.BuiltIn {
			policy := chain.Policy
			if policy == "" {
				policy = "ACCEPT"
			}
			fmt.Fprintf(&out, "Chain %s (policy %s %d packets, %d bytes)\n", chain.Name, policy, chain.Counters.Packets, chain.Counters.Bytes)
		} else {
			fmt.Fprintf(&out, "Chain %s (0 references)\n", chain.Name)
		}
		out.WriteString("num      pkts      bytes target     prot opt in     out     source               destination\n")
		for index, row := range mockRowsForChain(rs, table, chain.Name) {
			fmt.Fprintf(&out, "%-8d %-9d %-5d %-10s %-4s --  %-6s %-7s %-20s %s\n", index+1, 0, 0, row.target, row.protocol, row.inInterface, row.outInterface, row.source, row.destination)
		}
		out.WriteByte('\n')
	}
	return out.String()
}

type mockListRow struct {
	target       string
	protocol     string
	inInterface  string
	outInterface string
	source       string
	destination  string
	order        int
}

func mockRowsForChain(rs Ruleset, table, chain string) []mockListRow {
	var rows []mockListRow
	if table == "filter" {
		for _, rule := range rs.FilterRules {
			if rule.Chain == chain {
				rows = append(rows, mockListRow{
					target:       rule.Target,
					protocol:     protocolOrAll(rule.Protocol),
					inInterface:  interfaceOrAny(rule.InInterface),
					outInterface: interfaceOrAny(rule.OutInterface),
					source:       cidrOrAny(rule.Source),
					destination:  cidrOrAny(rule.Destination),
					order:        rule.Order,
				})
			}
		}
	}
	if table == "nat" {
		for _, rule := range rs.NatRules {
			if rule.Chain == chain {
				rows = append(rows, mockListRow{
					target:       rule.Target,
					protocol:     protocolOrAll(rule.Protocol),
					inInterface:  interfaceOrAny(rule.InInterface),
					outInterface: interfaceOrAny(rule.OutInterface),
					source:       cidrOrAny(rule.SourceCIDR),
					destination:  cidrOrAny(rule.DestinationCIDR),
					order:        rule.Order,
				})
			}
		}
	}
	for _, rule := range rs.RawRules {
		if rule.Table == table && rule.Chain == chain {
			rows = append(rows, mockListRow{
				target:       rawTarget(rule.Line),
				protocol:     "all",
				inInterface:  "*",
				outInterface: "*",
				source:       "0.0.0.0/0",
				destination:  "0.0.0.0/0",
				order:        rule.Order,
			})
		}
	}
	sort.SliceStable(rows, func(i, j int) bool {
		return rows[i].order < rows[j].order
	})
	return rows
}

func tableChains(rs Ruleset, table string) []ChainInfo {
	for _, info := range rs.Tables {
		if info.Name == table {
			chains := append([]ChainInfo(nil), info.Chains...)
			sort.SliceStable(chains, func(i, j int) bool {
				return chains[i].Order < chains[j].Order
			})
			return chains
		}
	}
	return nil
}

func rawTarget(line string) string {
	tokens, err := splitTokens(line)
	if err != nil {
		return "-"
	}
	for i := 0; i+1 < len(tokens); i++ {
		if tokens[i] == "-j" || tokens[i] == "--jump" {
			return tokens[i+1]
		}
	}
	return "-"
}

func protocolOrAll(value string) string {
	if value == "" {
		return "all"
	}
	return value
}

func interfaceOrAny(value string) string {
	if value == "" {
		return "*"
	}
	return value
}

func cidrOrAny(value string) string {
	if value == "" {
		return "0.0.0.0/0"
	}
	return value
}

func ApplyDiagnostics(rs *Ruleset, diagnostics Diagnostics) {
	rs.Diagnostics = diagnostics
	for _, command := range diagnostics.Commands {
		table, ok := listCommandTable(command)
		if !ok || command.ExitCode != 0 {
			continue
		}
		applyListMetadata(rs, table, parseListOutput(table, command.Stdout))
	}
	rs.Normalize()
}

type listTableMetadata struct {
	chains []listChainMetadata
}

type listChainMetadata struct {
	name     string
	policy   string
	order    int
	counters Counters
	rules    []listRuleMetadata
}

type listRuleMetadata struct {
	lineNumber int
	counters   Counters
}

func listCommandTable(command CommandDiagnostic) (string, bool) {
	args := command.Args
	if len(args) < 3 {
		return "", false
	}
	if args[0] != "-t" || args[2] != "-L" {
		return "", false
	}
	return args[1], true
}

func parseListOutput(table, output string) listTableMetadata {
	var result listTableMetadata
	current := -1
	for _, line := range strings.Split(output, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "Chain ") {
			chain := parseListChainHeader(line)
			chain.order = len(result.chains) + 1
			result.chains = append(result.chains, chain)
			current = len(result.chains) - 1
			continue
		}
		if current < 0 || strings.HasPrefix(line, "num ") {
			continue
		}
		rule, ok := parseListRuleLine(line)
		if ok {
			result.chains[current].rules = append(result.chains[current].rules, rule)
		}
	}
	_ = table
	return result
}

func parseListChainHeader(line string) listChainMetadata {
	body := strings.TrimPrefix(line, "Chain ")
	name, rest, _ := strings.Cut(body, " ")
	chain := listChainMetadata{name: name}
	if strings.Contains(rest, "(policy ") {
		fields := strings.Fields(strings.Trim(rest, "()"))
		if len(fields) >= 5 && fields[0] == "policy" {
			chain.policy = fields[1]
			chain.counters.Packets, _ = strconv.ParseUint(fields[2], 10, 64)
			chain.counters.Bytes, _ = strconv.ParseUint(fields[4], 10, 64)
		}
	}
	return chain
}

func parseListRuleLine(line string) (listRuleMetadata, bool) {
	fields := strings.Fields(line)
	if len(fields) < 3 {
		return listRuleMetadata{}, false
	}
	lineNumber, errLine := strconv.Atoi(fields[0])
	packets, errPackets := strconv.ParseUint(fields[1], 10, 64)
	bytes, errBytes := strconv.ParseUint(fields[2], 10, 64)
	if errLine != nil || errPackets != nil || errBytes != nil {
		return listRuleMetadata{}, false
	}
	return listRuleMetadata{
		lineNumber: lineNumber,
		counters:   Counters{Packets: packets, Bytes: bytes},
	}, true
}

func applyListMetadata(rs *Ruleset, table string, metadata listTableMetadata) {
	tableOrder := rs.tableOrder(table)
	for _, chain := range metadata.chains {
		chainOrder := rs.ensureChainInfo(table, chain.name, chain.policy, chain.counters)
		updatePolicyMetadata(rs, table, chain.name, tableOrder, chainOrder, chain.counters)
		updateRuleMetadata(rs, table, chain.name, tableOrder, chainOrder, chain.rules)
		updateChainLineCount(rs, table, chain.name, len(chain.rules))
	}
}

func updatePolicyMetadata(rs *Ruleset, table, chain string, tableOrder, chainOrder int, counters Counters) {
	for i := range rs.Policies {
		if rs.Policies[i].Table == table && rs.Policies[i].Chain == chain {
			rs.Policies[i].Position.TableOrder = tableOrder
			rs.Policies[i].Position.ChainOrder = chainOrder
			rs.Policies[i].Counters = counters
			return
		}
	}
}

func updateRuleMetadata(rs *Ruleset, table, chain string, tableOrder, chainOrder int, lines []listRuleMetadata) {
	var targets []ruleMetadataTarget
	for i := range rs.FilterRules {
		if table == "filter" && rs.FilterRules[i].Chain == chain {
			index := i
			targets = append(targets, ruleMetadataTarget{
				order: renderOrder(rs.FilterRules[i].Order, rs.FilterRules[i].Position),
				apply: func(line listRuleMetadata) {
					rs.FilterRules[index].Position.TableOrder = tableOrder
					rs.FilterRules[index].Position.ChainOrder = chainOrder
					rs.FilterRules[index].Position.LineNumber = line.lineNumber
					rs.FilterRules[index].Counters = line.counters
				},
			})
		}
	}
	for i := range rs.NatRules {
		if table == "nat" && rs.NatRules[i].Chain == chain {
			index := i
			targets = append(targets, ruleMetadataTarget{
				order: renderOrder(rs.NatRules[i].Order, rs.NatRules[i].Position),
				apply: func(line listRuleMetadata) {
					rs.NatRules[index].Position.TableOrder = tableOrder
					rs.NatRules[index].Position.ChainOrder = chainOrder
					rs.NatRules[index].Position.LineNumber = line.lineNumber
					rs.NatRules[index].Counters = line.counters
				},
			})
		}
	}
	for i := range rs.RawRules {
		if rs.RawRules[i].Table == table && rs.RawRules[i].Chain == chain {
			index := i
			targets = append(targets, ruleMetadataTarget{
				order: renderOrder(rs.RawRules[i].Order, rs.RawRules[i].Position),
				apply: func(line listRuleMetadata) {
					rs.RawRules[index].Position.TableOrder = tableOrder
					rs.RawRules[index].Position.ChainOrder = chainOrder
					rs.RawRules[index].Position.LineNumber = line.lineNumber
					rs.RawRules[index].Counters = line.counters
				},
			})
		}
	}
	sort.SliceStable(targets, func(i, j int) bool {
		return targets[i].order < targets[j].order
	})
	for i, target := range targets {
		if i < len(lines) {
			target.apply(lines[i])
		}
	}
}

type ruleMetadataTarget struct {
	order int
	apply func(listRuleMetadata)
}

func updateChainLineCount(rs *Ruleset, table, chain string, count int) {
	for tableIndex := range rs.Tables {
		if rs.Tables[tableIndex].Name != table {
			continue
		}
		for chainIndex := range rs.Tables[tableIndex].Chains {
			if rs.Tables[tableIndex].Chains[chainIndex].Name == chain {
				rs.Tables[tableIndex].Chains[chainIndex].LineCount = count
				return
			}
		}
	}
}
