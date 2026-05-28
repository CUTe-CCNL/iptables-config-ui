package firewall

import (
	"crypto/sha256"
	"encoding/hex"
	"regexp"
	"strings"
)

var (
	chainCounterPattern = regexp.MustCompile(`^(:\S+\s+\S+)\s+\[\d+:\d+\](.*)$`)
	ruleCounterPattern  = regexp.MustCompile(`^(-A\s+\S+)\s+-c\s+\d+\s+\d+(\s+.*)?$`)
)

func SnapshotID(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:12])
}

func rulesetSnapshotID(raw string) string {
	return SnapshotID(canonicalRulesetSnapshot(raw))
}

func canonicalRulesetSnapshot(raw string) string {
	var out strings.Builder
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out.WriteString(canonicalSnapshotLine(line))
		out.WriteByte('\n')
	}
	return out.String()
}

func canonicalSnapshotLine(line string) string {
	line = chainCounterPattern.ReplaceAllString(line, "$1 [0:0]$2")
	return ruleCounterPattern.ReplaceAllString(line, "$1$2")
}
