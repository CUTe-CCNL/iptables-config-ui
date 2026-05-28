package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"iptables-config-ui/internal/firewall"
	"iptables-config-ui/internal/server"
)

//go:embed web/dist/* web/dist/**/*
var webDist embed.FS

func main() {
	addr := flag.String("addr", "0.0.0.0:8921", "HTTP listen address")
	mock := flag.Bool("mock", false, "use an in-memory iptables backend for development")
	flag.Parse()

	token, err := randomToken()
	if err != nil {
		log.Fatalf("generate session token: %v", err)
	}

	var runner firewall.Runner = firewall.NewExecRunner()
	if *mock {
		runner = firewall.NewMockRunner()
	} else if os.Geteuid() != 0 {
		log.Printf("warning: real iptables mode usually requires root; start with sudo or use --mock")
	}

	manager := firewall.NewManager(runner)
	staticFS, err := fs.Sub(webDist, "web/dist")
	if err != nil {
		log.Fatalf("load embedded ui: %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	httpServer := &http.Server{Addr: *addr}
	handler := server.New(server.Config{
		Addr:         *addr,
		Token:        token,
		Manager:      manager,
		StaticFS:     staticFS,
		ShutdownFunc: func() { shutdownHTTPServer(httpServer) },
	})
	httpServer.Handler = handler

	go func() {
		<-ctx.Done()
		shutdownHTTPServer(httpServer)
	}()

	log.Printf("iptables-config-ui listening on %s", *addr)
	log.Printf("mode=%s session-token=%s", modeLabel(*mock), token)
	for _, url := range accessURLs(*addr, token) {
		log.Printf("open %s", url)
	}

	err = httpServer.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		log.Fatalf("serve: %v", err)
	}
}

func shutdownHTTPServer(srv *http.Server) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func randomToken() (string, error) {
	var b [24]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

func modeLabel(mock bool) string {
	if mock {
		return "mock"
	}
	return "live"
}

func accessURLs(addr string, token string) []string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return []string{"http://" + addr + "/?token=" + token}
	}
	if host == "" || host == "0.0.0.0" || host == "::" || host == "[::]" {
		urls := []string{"http://127.0.0.1:" + port + "/?token=" + token}
		if hostname, err := os.Hostname(); err == nil && hostname != "" {
			urls = append(urls, "http://"+hostname+":"+port+"/?token="+token)
		}
		for _, ip := range nonLoopbackIPv4s() {
			urls = append(urls, "http://"+ip+":"+port+"/?token="+token)
		}
		return urls
	}
	return []string{"http://" + net.JoinHostPort(host, port) + "/?token=" + token}
}

func nonLoopbackIPv4s() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var ips []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			ip = ip.To4()
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ips = append(ips, ip.String())
		}
	}
	return ips
}

func init() {
	log.SetFlags(0)
	log.SetPrefix(fmt.Sprintf("[%d] ", os.Getpid()))
}
