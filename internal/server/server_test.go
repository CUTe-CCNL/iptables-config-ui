package server

import (
	"context"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"iptables-config-ui/internal/firewall"
)

func TestMutatingEndpointsRequireToken(t *testing.T) {
	handler := testHandler(firewall.NewMockRunner(), "secret")
	req := httptest.NewRequest(http.MethodPost, "/api/rollback", strings.NewReader(`{}`))
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestMockModeReturnsRules(t *testing.T) {
	handler := testHandler(firewall.NewMockRunner(), "secret")
	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "filterRules") {
		t.Fatalf("expected rules response, got %s", rec.Body.String())
	}
}

func TestSystemDoesNotExposeSessionToken(t *testing.T) {
	handler := testHandler(firewall.NewMockRunner(), "secret")
	req := httptest.NewRequest(http.MethodGet, "/api/system", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "secret") || strings.Contains(rec.Body.String(), "sessionToken") {
		t.Fatalf("system response leaked session token: %s", rec.Body.String())
	}
}

func TestMissingIptablesReturnsUnavailable(t *testing.T) {
	handler := testHandler(unavailableRunner{}, "secret")
	req := httptest.NewRequest(http.MethodGet, "/api/rules", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
}

func testHandler(runner firewall.Runner, token string) http.Handler {
	return New(Config{
		Addr:     "127.0.0.1:8921",
		Token:    token,
		Manager:  firewall.NewManager(runner),
		StaticFS: testFS(),
	})
}

func testFS() fs.FS {
	return fstest.MapFS{
		"index.html": &fstest.MapFile{Data: []byte("<div>ok</div>")},
	}
}

type unavailableRunner struct{}

func (unavailableRunner) Current(context.Context) (string, error) {
	return "", firewall.ErrCommandsUnavailable
}

func (unavailableRunner) Apply(context.Context, string) error {
	return errors.New("unavailable")
}

func (unavailableRunner) Commands() []firewall.CommandStatus {
	return []firewall.CommandStatus{{Name: "iptables-save", Available: false}}
}

func (unavailableRunner) Mock() bool {
	return false
}
