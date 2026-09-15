// Package ui embeds the Next.js static export and serves it.
package ui

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:web/out
var out embed.FS

// Handler returns an http.Handler serving the embedded static site.
// If web/out is missing at build time (dev), it falls back to a minimal placeholder.
func Handler() http.Handler {
	sub, err := fs.Sub(out, "web/out/out")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte(`<!doctype html><html><body><h1>Flags API</h1><p>UI not built. Run <code>make web</code>.</p></body></html>`))
		})
	}
	fileServer := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		// immutable hashed assets
		if strings.HasPrefix(p, "/_next/static/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else if strings.HasSuffix(p, ".html") || p == "/" || !strings.Contains(strings.TrimPrefix(p, "/"), ".") {
			// HTML / routes: revalidate
			w.Header().Set("Cache-Control", "public, max-age=0, must-revalidate")
		}
		// try exact file; else 404.html; else index fallback for directory roots
		// http.FileServer already handles index.html; add custom 404
		rec := &statusCapture{ResponseWriter: w, status: 200}
		fileServer.ServeHTTP(rec, r)
		if rec.status == 404 {
			// serve embedded 404.html with 404 status if present
			if b, err := fs.ReadFile(sub, "404.html"); err == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write(b)
			}
		}
	})
}

type statusCapture struct {
	http.ResponseWriter
	status int
}

func (s *statusCapture) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}
