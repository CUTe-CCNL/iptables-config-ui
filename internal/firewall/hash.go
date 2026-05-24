package firewall

import (
	"crypto/sha256"
	"encoding/hex"
)

func SnapshotID(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:12])
}
