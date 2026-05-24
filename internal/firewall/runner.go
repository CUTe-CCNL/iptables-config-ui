package firewall

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os/exec"
	"sync"
)

var ErrCommandsUnavailable = errors.New("iptables commands unavailable")

type Runner interface {
	Current(context.Context) (string, error)
	Apply(context.Context, string) error
	Commands() []CommandStatus
	Mock() bool
}

type ExecRunner struct {
	iptablesSave    string
	iptablesRestore string
	iptables        string
	statuses        []CommandStatus
}

func NewExecRunner() *ExecRunner {
	r := &ExecRunner{}
	r.iptables = lookupCommand("iptables", &r.statuses)
	r.iptablesSave = lookupCommand("iptables-save", &r.statuses)
	r.iptablesRestore = lookupCommand("iptables-restore", &r.statuses)
	return r
}

func (r *ExecRunner) Current(ctx context.Context) (string, error) {
	if r.iptablesSave == "" {
		return "", fmt.Errorf("%w: iptables-save not found", ErrCommandsUnavailable)
	}
	out, err := exec.CommandContext(ctx, r.iptablesSave).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("iptables-save: %w: %s", err, bytes.TrimSpace(out))
	}
	return string(out), nil
}

func (r *ExecRunner) Apply(ctx context.Context, rules string) error {
	if r.iptablesRestore == "" {
		return fmt.Errorf("%w: iptables-restore not found", ErrCommandsUnavailable)
	}
	cmd := exec.CommandContext(ctx, r.iptablesRestore)
	cmd.Stdin = bytes.NewBufferString(rules)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("iptables-restore: %w: %s", err, bytes.TrimSpace(out))
	}
	return nil
}

func (r *ExecRunner) Commands() []CommandStatus {
	return append([]CommandStatus(nil), r.statuses...)
}

func (r *ExecRunner) Mock() bool { return false }

func lookupCommand(name string, statuses *[]CommandStatus) string {
	path, err := exec.LookPath(name)
	status := CommandStatus{Name: name, Path: path, Available: err == nil}
	if err != nil {
		status.Error = err.Error()
	}
	*statuses = append(*statuses, status)
	return path
}

type MockRunner struct {
	mu  sync.Mutex
	raw string
}

func NewMockRunner() *MockRunner {
	return &MockRunner{raw: MockRules()}
}

func (r *MockRunner) Current(context.Context) (string, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.raw, nil
}

func (r *MockRunner) Apply(_ context.Context, rules string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if bytes.Contains([]byte(rules), []byte("MOCK_FAIL")) {
		return errors.New("mock apply failure requested by rule content")
	}
	r.raw = rules
	return nil
}

func (r *MockRunner) Commands() []CommandStatus {
	return []CommandStatus{
		{Name: "iptables", Path: "/mock/iptables", Available: true},
		{Name: "iptables-save", Path: "/mock/iptables-save", Available: true},
		{Name: "iptables-restore", Path: "/mock/iptables-restore", Available: true},
	}
}

func (r *MockRunner) Mock() bool { return true }

func MockRules() string {
	return `*filter
:INPUT DROP [0:0]
:FORWARD DROP [0:0]
:OUTPUT ACCEPT [0:0]
-A INPUT -i lo -j ACCEPT
-A INPUT -p tcp -m tcp --dport 22 -m comment --comment "SSH admin" -j ACCEPT
-A INPUT -p tcp -m tcp --dport 443 -m comment --comment "HTTPS service" -j ACCEPT
-A INPUT -p icmp -j ACCEPT
-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
COMMIT
*nat
:PREROUTING ACCEPT [0:0]
:INPUT ACCEPT [0:0]
:OUTPUT ACCEPT [0:0]
:POSTROUTING ACCEPT [0:0]
-A PREROUTING -p tcp -m tcp --dport 8443 -j DNAT --to-destination 10.0.0.20:443
-A POSTROUTING -s 10.0.0.0/24 -o eth0 -j MASQUERADE
COMMIT
`
}
