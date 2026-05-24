package server

import (
	"encoding/json"
	"errors"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"iptables-config-ui/internal/firewall"
)

type Config struct {
	Addr         string
	Token        string
	Manager      *firewall.Manager
	StaticFS     fs.FS
	ShutdownFunc func()
}

type Server struct {
	addr         string
	token        string
	manager      *firewall.Manager
	static       http.Handler
	shutdownFunc func()
}

func New(cfg Config) http.Handler {
	s := &Server{
		addr:         cfg.Addr,
		token:        cfg.Token,
		manager:      cfg.Manager,
		static:       spaHandler(cfg.StaticFS),
		shutdownFunc: cfg.ShutdownFunc,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/system", s.handleSystem)
	mux.HandleFunc("GET /api/rules", s.handleRules)
	mux.HandleFunc("POST /api/validate", s.withToken(s.handleValidate))
	mux.HandleFunc("POST /api/apply", s.withToken(s.handleApply))
	mux.HandleFunc("POST /api/rollback", s.withToken(s.handleRollback))
	mux.HandleFunc("POST /api/shutdown", s.withToken(s.handleShutdown))
	mux.Handle("/", s.static)
	return withCommonHeaders(mux)
}

func (s *Server) handleSystem(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, s.manager.SystemStatus(s.addr))
}

func (s *Server) handleRules(w http.ResponseWriter, r *http.Request) {
	rules, err := s.manager.Rules(r.Context())
	if err != nil {
		writeError(w, statusForError(err), err)
		return
	}
	writeJSON(w, http.StatusOK, firewall.RulesResponse{Ruleset: rules})
}

func (s *Server) handleValidate(w http.ResponseWriter, r *http.Request) {
	var req firewall.ValidateRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, s.manager.Validate(req.Ruleset))
}

func (s *Server) handleApply(w http.ResponseWriter, r *http.Request) {
	var req firewall.ApplyRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	rules, err := s.manager.Apply(r.Context(), req)
	if err != nil {
		writeError(w, statusForError(err), err)
		return
	}
	writeJSON(w, http.StatusOK, firewall.RulesResponse{Ruleset: rules})
}

func (s *Server) handleRollback(w http.ResponseWriter, r *http.Request) {
	rules, err := s.manager.Rollback(r.Context())
	if err != nil {
		writeError(w, statusForError(err), err)
		return
	}
	writeJSON(w, http.StatusOK, firewall.RulesResponse{Ruleset: rules})
}

func (s *Server) handleShutdown(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "shutting down"})
	if s.shutdownFunc != nil {
		go func() {
			time.Sleep(150 * time.Millisecond)
			s.shutdownFunc()
		}()
	}
}

func (s *Server) withToken(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Session-Token") != s.token {
			writeError(w, http.StatusUnauthorized, errors.New("missing or invalid session token"))
			return
		}
		next(w, r)
	}
}

func decodeJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]any{
		"error": err.Error(),
	})
}

func statusForError(err error) int {
	if errors.Is(err, firewall.ErrCommandsUnavailable) {
		return http.StatusServiceUnavailable
	}
	if errors.Is(err, firewall.ErrSnapshotDrift) {
		return http.StatusConflict
	}
	message := err.Error()
	if strings.Contains(message, "validation failed") {
		return http.StatusBadRequest
	}
	if strings.Contains(message, "no rollback") {
		return http.StatusConflict
	}
	return http.StatusInternalServerError
}

func withCommonHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func spaHandler(staticFS fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(staticFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}
		if _, err := fs.Stat(staticFS, path); err == nil {
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}
