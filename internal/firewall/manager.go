package firewall

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/user"
	"sync"
)

var ErrSnapshotDrift = errors.New("live iptables rules changed since draft was loaded")

type Manager struct {
	runner Runner

	mu               sync.Mutex
	lastRollbackRaw  string
	lastRollbackID   string
	lastRollbackUsed bool
}

func NewManager(runner Runner) *Manager {
	return &Manager{runner: runner}
}

func (m *Manager) SystemStatus(addr string) SystemStatus {
	host, _ := os.Hostname()
	currentUser := "unknown"
	if u, err := user.Current(); err == nil {
		currentUser = u.Username
	}
	return SystemStatus{
		Host:     host,
		User:     currentUser,
		Addr:     addr,
		Mock:     m.runner.Mock(),
		Root:     os.Geteuid() == 0,
		Commands: nonNilCommands(m.runner.Commands()),
		Capabilities: []string{
			"ipv4-filter",
			"ipv4-nat-port-forward",
			"ipv4-nat-masquerade",
			"draft-apply",
			"in-memory-rollback",
			"embedded-ui",
		},
	}
}

func nonNilCommands(commands []CommandStatus) []CommandStatus {
	if commands == nil {
		return []CommandStatus{}
	}
	return commands
}

func (m *Manager) Rules(ctx context.Context) (Ruleset, error) {
	raw, err := m.runner.Current(ctx)
	if err != nil {
		return Ruleset{}, err
	}
	return m.parseRuleset(ctx, raw)
}

func (m *Manager) Validate(rs Ruleset) ValidationResult {
	return ValidateRuleset(rs)
}

func (m *Manager) Apply(ctx context.Context, req ApplyRequest) (Ruleset, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	current, err := m.runner.Current(ctx)
	if err != nil {
		return Ruleset{}, err
	}
	if rulesetSnapshotID(current) != req.SnapshotID {
		return Ruleset{}, ErrSnapshotDrift
	}
	if result := ValidateRuleset(req.Ruleset); !result.Valid {
		return Ruleset{}, fmt.Errorf("validation failed: %v", result.Errors)
	}
	nextRaw, err := RenderRuleset(req.Ruleset)
	if err != nil {
		return Ruleset{}, err
	}

	m.lastRollbackRaw = current
	m.lastRollbackID = rulesetSnapshotID(current)
	m.lastRollbackUsed = false

	if err := m.runner.Apply(ctx, nextRaw); err != nil {
		restoreErr := m.runner.Apply(ctx, current)
		if restoreErr != nil {
			return Ruleset{}, fmt.Errorf("apply failed: %v; rollback failed: %v", err, restoreErr)
		}
		return Ruleset{}, fmt.Errorf("apply failed and was rolled back: %w", err)
	}
	return m.parseRuleset(ctx, nextRaw)
}

func (m *Manager) Rollback(ctx context.Context) (Ruleset, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.lastRollbackRaw == "" || m.lastRollbackUsed {
		return Ruleset{}, errors.New("no rollback snapshot available")
	}
	if err := m.runner.Apply(ctx, m.lastRollbackRaw); err != nil {
		return Ruleset{}, err
	}
	m.lastRollbackUsed = true
	return m.parseRuleset(ctx, m.lastRollbackRaw)
}

func (m *Manager) parseRuleset(ctx context.Context, raw string) (Ruleset, error) {
	ruleset, err := ParseRuleset(raw)
	if err != nil {
		return Ruleset{}, err
	}
	if diagnosticRunner, ok := m.runner.(DiagnosticsRunner); ok {
		ApplyDiagnostics(&ruleset, diagnosticRunner.Diagnostics(ctx, raw))
	}
	return ruleset, nil
}
