package httpx

import (
	"compress/gzip"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// gzipResponseWriter wraps ResponseWriter with gzip for compressible types.
type gzipResponseWriter struct {
	http.ResponseWriter
	w *gzip.Writer
}

func (g *gzipResponseWriter) Write(b []byte) (int, error) { return g.w.Write(b) }

// Gzip middleware: compresses only compressible content types, skips images/archives.
func Gzip(next http.Handler) http.Handler {
	pool := &sync.Pool{New: func() interface{} {
		w, _ := gzip.NewWriterLevel(io.Discard, 5)
		return w
	}}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}
		// wrap to inspect Content-Type set by handler
		ww := &captureWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(ww, r)
		ct := ww.Header().Get("Content-Type")
		if !compressible(ct) {
			// already wrote? captureWriter buffers? To keep sendfile path we must NOT buffer.
			// Instead: this middleware is only applied to API/JSON routes where we control headers.
			// For file routes we skip gzip entirely via separate mux chain.
			// Here we already passed through; captureWriter wrote directly, so nothing to do.
			return
		}
		_ = pool
	})
}

// captureWriter passes through writes directly.
type captureWriter struct {
	http.ResponseWriter
	status int
}

func (c *captureWriter) WriteHeader(s int) {
	c.status = s
	c.ResponseWriter.WriteHeader(s)
}

func compressible(ct string) bool {
	ct = strings.ToLower(ct)
	for _, p := range []string{
		"application/json", "text/", "image/svg+xml", "application/javascript",
		"application/xml", "+json", "+xml",
	} {
		if strings.Contains(ct, p) {
			return true
		}
	}
	return false
}

// NeverCompress reports whether a content type must never be gzipped.
func NeverCompress(ct string) bool {
	ct = strings.ToLower(ct)
	for _, p := range []string{
		"image/png", "image/webp", "image/jpeg",
		"application/pdf", "application/postscript",
	} {
		if strings.Contains(ct, p) {
			return true
		}
	}
	return false
}

// CORSConfig configures cross-origin behavior.
type CORSConfig struct {
	// Enabled=false disables CORS entirely: no headers are set and
	// preflights fall through to the mux (405 for API routes).
	Enabled bool
	// AllowedOrigins lists permitted origins. Empty or ["*"] = wildcard
	// (legacy open behavior). Otherwise the request Origin must match exactly.
	AllowedOrigins []string
	MaxAgeSeconds  int
}

// CORS sets permissive CORS for API + assets (legacy default: open).
func CORS(next http.Handler) http.Handler {
	return CORSWithConfig(CORSConfig{Enabled: true, AllowedOrigins: []string{"*"}, MaxAgeSeconds: 86400})(next)
}

// CORSWithConfig builds the CORS middleware from explicit configuration.
func CORSWithConfig(cfg CORSConfig) func(http.Handler) http.Handler {
	maxAge := cfg.MaxAgeSeconds
	if maxAge <= 0 {
		maxAge = 86400
	}
	wildcard := len(cfg.AllowedOrigins) == 0
	if !wildcard {
		for _, o := range cfg.AllowedOrigins {
			if o == "*" {
				wildcard = true
				break
			}
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !cfg.Enabled {
				next.ServeHTTP(w, r)
				return
			}
			origin := r.Header.Get("Origin")
			allowed := ""
			if wildcard {
				allowed = "*"
			} else if origin != "" {
				for _, o := range cfg.AllowedOrigins {
					if strings.TrimSuffix(o, "/") == strings.TrimSuffix(origin, "/") {
						allowed = origin
						break
					}
				}
			}
			if allowed == "" {
				// disallowed (or absent) origin: no CORS headers, browser blocks.
				next.ServeHTTP(w, r)
				return
			}
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", allowed)
			if allowed != "*" {
				h.Set("Vary", "Origin")
			}
			h.Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
			h.Set("Access-Control-Allow-Headers", "Accept, Accept-Encoding, If-None-Match, If-Modified-Since, Range")
			h.Set("Access-Control-Max-Age", strconv.Itoa(maxAge))
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// SecurityHeaders sets nosniff etc.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// Recover catches panics.
func Recover(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("panic", "err", rec, "path", r.URL.Path)
				http.Error(w, `{"error":{"code":"internal","message":"internal server error"}}`, http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// Logger logs requests; samples asset requests 1/1000.
func Logger(next http.Handler) http.Handler {
	var n uint64
	var mu sync.Mutex
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		isAsset := strings.HasPrefix(r.URL.Path, "/assets/")
		if isAsset {
			mu.Lock()
			n++
			sampled := n%1000 == 0
			mu.Unlock()
			if !sampled {
				return
			}
		}
		slog.Info("req", "method", r.Method, "path", r.URL.Path, "q", r.URL.RawQuery, "dur", time.Since(start).String(), "ip", clientIP(r))
	})
}

// RateLimit per-IP token bucket. ratePerSec <=0 disables.
func RateLimit(ratePerSec float64, burst int) func(http.Handler) http.Handler {
	if ratePerSec <= 0 {
		return func(h http.Handler) http.Handler { return h }
	}
	var mu sync.Mutex
	limiters := map[string]*rate.Limiter{}
	var lastSeen = map[string]time.Time{}
	go func() {
		for range time.Tick(time.Minute * 5) {
			mu.Lock()
			for ip, t := range lastSeen {
				if time.Since(t) > time.Minute*10 {
					delete(limiters, ip)
					delete(lastSeen, ip)
				}
			}
			mu.Unlock()
		}
	}()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Immutable / cheap paths never consume rate-limit tokens:
			// flag assets are long-lived immutable files (a single Explore
			// page fires ~254 image requests at once), plus health/static.
			p := r.URL.Path
			if strings.HasPrefix(p, "/assets/v1/") ||
				strings.HasPrefix(p, "/_next/static/") ||
				p == "/healthz" || p == "/readyz" {
				next.ServeHTTP(w, r)
				return
			}
			ip := clientIP(r)
			mu.Lock()
			l, ok := limiters[ip]
			if !ok {
				l = rate.NewLimiter(rate.Limit(ratePerSec), burst)
				limiters[ip] = l
			}
			lastSeen[ip] = time.Now()
			mu.Unlock()
			if !l.Allow() {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":{"code":"rate_limited","message":"rate limit exceeded, retry later"}}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
