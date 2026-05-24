package firewall

import (
	"context"
	"errors"
	"testing"
)

type fakeRunner struct {
	raw       string
	failNext  bool
	mock      bool
	commands  []CommandStatus
	applySeen []string
}

func (r *fakeRunner) Current(context.Context) (string, error) {
	return r.raw, nil
}

func (r *fakeRunner) Apply(_ context.Context, rules string) error {
	r.applySeen = append(r.applySeen, rules)
	if r.failNext {
		r.failNext = false
		return errors.New("apply failed")
	}
	r.raw = rules
	return nil
}

func (r *fakeRunner) Commands() []CommandStatus {
	return r.commands
}

func (r *fakeRunner) Mock() bool {
	return r.mock
}

func TestApplyRejectsSnapshotDrift(t *testing.T) {
	runner := &fakeRunner{raw: MockRules()}
	manager := NewManager(runner)
	rs, err := manager.Rules(context.Background())
	if err != nil {
		t.Fatalf("Rules: %v", err)
	}
	runner.raw = stringsReplaceFirst(runner.raw, "HTTPS service", "HTTPS changed elsewhere")
	_, err = manager.Apply(context.Background(), ApplyRequest{SnapshotID: rs.SnapshotID, Ruleset: rs})
	if !errors.Is(err, ErrSnapshotDrift) {
		t.Fatalf("expected ErrSnapshotDrift, got %v", err)
	}
}

func TestApplyFailureRollsBackCurrentRules(t *testing.T) {
	runner := &fakeRunner{raw: MockRules()}
	manager := NewManager(runner)
	rs, err := manager.Rules(context.Background())
	if err != nil {
		t.Fatalf("Rules: %v", err)
	}
	original := runner.raw
	rs.FilterRules[0].Comment = "changed"
	runner.failNext = true
	_, err = manager.Apply(context.Background(), ApplyRequest{SnapshotID: rs.SnapshotID, Ruleset: rs})
	if err == nil {
		t.Fatal("expected apply failure")
	}
	if runner.raw != original {
		t.Fatalf("expected rollback to original rules")
	}
	if len(runner.applySeen) != 2 {
		t.Fatalf("expected failed apply plus rollback apply, got %d", len(runner.applySeen))
	}
}

func TestRollbackRestoresLastSnapshotOnce(t *testing.T) {
	runner := &fakeRunner{raw: MockRules()}
	manager := NewManager(runner)
	rs, err := manager.Rules(context.Background())
	if err != nil {
		t.Fatalf("Rules: %v", err)
	}
	rs.FilterRules[0].Comment = "changed"
	applied, err := manager.Apply(context.Background(), ApplyRequest{SnapshotID: rs.SnapshotID, Ruleset: rs})
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if applied.SnapshotID == rs.SnapshotID {
		t.Fatal("expected new snapshot after apply")
	}
	rolledBack, err := manager.Rollback(context.Background())
	if err != nil {
		t.Fatalf("Rollback: %v", err)
	}
	if rolledBack.SnapshotID != rs.SnapshotID {
		t.Fatalf("expected rollback snapshot %s, got %s", rs.SnapshotID, rolledBack.SnapshotID)
	}
	if _, err := manager.Rollback(context.Background()); err == nil {
		t.Fatal("expected second rollback to fail")
	}
}

func stringsReplaceFirst(s, old, new string) string {
	idx := -1
	for i := 0; i+len(old) <= len(s); i++ {
		if s[i:i+len(old)] == old {
			idx = i
			break
		}
	}
	if idx < 0 {
		return s
	}
	return s[:idx] + new + s[idx+len(old):]
}
