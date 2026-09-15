package main

import (
	"context"
	"crypto/tls"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/acme/autocert"

	"flagsapi/internal/api"
	"flagsapi/internal/config"
	"flagsapi/internal/httpx"
	"flagsapi/internal/meta"
	"flagsapi/internal/quiz"
	"flagsapi/internal/resolver"
	"flagsapi/internal/ui"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load(os.Args[1:])
	t0 := time.Now()
	slog.Info("boot", "assets", cfg.AssetsDir, "addr", cfg.Addr, "domain", cfg.Domain)

	t := time.Now()
	idx, err := resolver.Build(cfg.AssetsDir)
	if err != nil {
		slog.Error("resolver build failed", "err", err)
		os.Exit(1)
	}
	dResolver := time.Since(t)

	t = time.Now()
	store, err := meta.Load(cfg.AssetsDir)
	if err != nil {
		slog.Error("meta load failed", "err", err)
		os.Exit(1)
	}
	dMeta := time.Since(t)

	t = time.Now()
	srv := api.New(store, idx)
	dPre := time.Since(t)

	t = time.Now()
	qstore, err := quiz.New(store)
	if err != nil {
		slog.Error("quiz build failed", "err", err)
		os.Exit(1)
	}
	dQuiz := time.Since(t)

	mux := http.NewServeMux()
	// API
	mux.HandleFunc("GET /api/v1/countries", srv.Countries)
	mux.HandleFunc("HEAD /api/v1/countries", srv.Countries)
	mux.HandleFunc("GET /api/v1/countries/{code}", srv.CountryOne)
	mux.HandleFunc("HEAD /api/v1/countries/{code}", srv.CountryOne)
	mux.HandleFunc("GET /api/v1/countries/{code}/assets", srv.CountryAssets)
	mux.HandleFunc("HEAD /api/v1/countries/{code}/assets", srv.CountryAssets)
	mux.HandleFunc("GET /api/v1/assets", srv.GlobalAssets)
	mux.HandleFunc("HEAD /api/v1/assets", srv.GlobalAssets)
	mux.HandleFunc("GET /api/flags/{code}", srv.Flags)
	mux.HandleFunc("HEAD /api/flags/{code}", srv.Flags)
	mux.HandleFunc("GET /api/v1/flags/{code}", srv.Flags)
	mux.HandleFunc("HEAD /api/v1/flags/{code}", srv.Flags)
	// quiz (stateless seeded; aliases without /v1)
	mux.HandleFunc("GET /api/v1/quiz/meta", qstore.Meta)
	mux.HandleFunc("GET /api/quiz/meta", qstore.Meta)
	mux.HandleFunc("GET /api/v1/quiz/questions", qstore.Questions)
	mux.HandleFunc("GET /api/quiz/questions", qstore.Questions)
	mux.HandleFunc("GET /api/v1/quiz/daily", qstore.Daily)
	mux.HandleFunc("GET /api/quiz/daily", qstore.Daily)
	mux.HandleFunc("POST /api/v1/quiz/grade", qstore.GradeHTTP)
	mux.HandleFunc("POST /api/quiz/grade", qstore.GradeHTTP)
	// canonical assets
	mux.HandleFunc("GET /assets/v1/", srv.CanonicalAssets)
	mux.HandleFunc("HEAD /assets/v1/", srv.CanonicalAssets)
	// health
	mux.HandleFunc("GET /healthz", srv.Healthz)
	mux.HandleFunc("GET /readyz", srv.Readyz)

	// UI (embedded static export) — catch-all for unmatched paths.
	// NOTE: registered without a method so it never conflicts with the
	// method-specific patterns above; ServeMux prefers more specific routes.
	uiHandler := ui.Handler()
	mux.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/assets/") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`{"error":{"code":"not_found","message":"not found"}}`))
			return
		}
		uiHandler.ServeHTTP(w, r)
	}))

	// pprof on localhost only
	go localhostPprof()

	var handler http.Handler = mux
	handler = httpx.Recover(handler)
	handler = httpx.CORSWithConfig(httpx.CORSConfig{
		Enabled:        cfg.Cors.Enabled,
		AllowedOrigins: cfg.Cors.AllowedOrigins,
		MaxAgeSeconds:  cfg.Cors.MaxAgeSeconds,
	})(handler)
	handler = httpx.SecurityHeaders(handler)
	rl := httpx.RateLimit(cfg.RateLimit, cfg.Burst)
	handler = rl(handler)
	handler = httpx.Logger(handler)

	httpSrv := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	slog.Info("ready",
		"countries", len(store.All),
		"files", len(idx.AllRelPaths),
		"bytes", idx.TotalBytes,
		"resolver_ms", dResolver.Milliseconds(),
		"meta_ms", dMeta.Milliseconds(),
		"precompute_ms", dPre.Milliseconds(),
		"quiz_ms", dQuiz.Milliseconds(),
		"total_ms", time.Since(t0).Milliseconds(),
	)

	// background page-cache warmup
	if cfg.Warm {
		go warmCache(cfg.AssetsDir, idx.AllRelPaths)
	}

	if cfg.Domain != "" {
		// autocert TLS on :443 + HTTP-01 + redirect on :80. Still one process.
		if err := os.MkdirAll(cfg.CertDir, 0o755); err != nil {
			slog.Error("cert dir", "err", err)
			os.Exit(1)
		}
		m := &autocert.Manager{
			Prompt:     autocert.AcceptTOS,
			HostPolicy: autocert.HostWhitelist(cfg.Domain),
			Cache:      autocert.DirCache(cfg.CertDir),
		}
		httpSrv.Addr = ":443"
		httpSrv.TLSConfig = &tls.Config{GetCertificate: m.GetCertificate, NextProtos: []string{"h2", "http/1.1"}}
		go func() {
			redir := &http.Server{
				Addr: ":80",
				Handler: m.HTTPHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					host := r.Host
					if h, _, err := net.SplitHostPort(r.Host); err == nil {
						host = h
					}
					http.Redirect(w, r, "https://"+host+r.RequestURI, http.StatusMovedPermanently)
				})),
				ReadHeaderTimeout: 10 * time.Second,
			}
			slog.Info("listening http redirect", "addr", ":80")
			if err := redir.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				slog.Error("redirect server", "err", err)
			}
		}()
		slog.Info("listening https", "addr", ":443", "domain", cfg.Domain)
		if err := httpSrv.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
			slog.Error("https server", "err", err)
			os.Exit(1)
		}
		return
	}

	httpSrv.Addr = cfg.Addr
	slog.Info("listening", "addr", cfg.Addr)
	if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server", "err", err)
		os.Exit(1)
	}
	_ = context.Background()
}

func warmCache(assetsDir string, rels []string) {
	t := time.Now()
	var n int64
	buf := make([]byte, 128*1024)
	for _, rel := range rels {
		f, err := os.Open(filepath.Join(assetsDir, filepath.FromSlash(rel)))
		if err != nil {
			continue
		}
		for {
			nr, err := f.Read(buf)
			if nr > 0 {
				n += int64(nr)
			}
			if err != nil {
				break
			}
		}
		f.Close()
	}
	slog.Info("warmup done", "files", len(rels), "bytes", n, "dur", time.Since(t).String())
}

func localhostPprof() {
	// pprof bound to localhost only; check RemoteAddr before serving.
	mux := http.NewServeMux()
	mux.HandleFunc("/debug/pprof/", func(w http.ResponseWriter, r *http.Request) {
		host, _, _ := net.SplitHostPort(r.RemoteAddr)
		if host != "127.0.0.1" && host != "::1" {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		http.DefaultServeMux.ServeHTTP(w, r)
	})
	ln, err := net.Listen("tcp", "127.0.0.1:6060")
	if err != nil {
		return
	}
	_ = http.Serve(ln, mux)
}
