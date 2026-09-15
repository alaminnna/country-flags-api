package httpx

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func corsHeaders(t *testing.T, h http.Handler, method, origin string) (int, http.Header) {
	t.Helper()
	req := httptest.NewRequest(method, "/api/v1/assets", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Code, rec.Header()
}

func TestCORSWithConfigWildcard(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	h := CORSWithConfig(CORSConfig{Enabled: true, AllowedOrigins: []string{"*"}, MaxAgeSeconds: 60})(next)

	code, hdr := corsHeaders(t, h, "GET", "https://anything.example")
	if code != 200 || hdr.Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("wildcard GET: code=%d acao=%q", code, hdr.Get("Access-Control-Allow-Origin"))
	}
	if got := hdr.Get("Access-Control-Max-Age"); got != "60" {
		t.Fatalf("max-age=%q", got)
	}
	code, _ = corsHeaders(t, h, "OPTIONS", "https://anything.example")
	if code != 204 {
		t.Fatalf("wildcard preflight: code=%d", code)
	}
}

func TestCORSWithConfigDisabled(t *testing.T) {
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { called = true })
	h := CORSWithConfig(CORSConfig{Enabled: false})(next)

	code, hdr := corsHeaders(t, h, "GET", "https://anything.example")
	if !called || code != 200 {
		t.Fatalf("disabled must pass through: called=%v code=%d", called, code)
	}
	if v := hdr.Get("Access-Control-Allow-Origin"); v != "" {
		t.Fatalf("disabled must set no CORS headers, got %q", v)
	}
}

func TestCORSWithConfigAllowlist(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	h := CORSWithConfig(CORSConfig{Enabled: true, AllowedOrigins: []string{"https://app.example.com"}})(next)

	_, hdr := corsHeaders(t, h, "GET", "https://app.example.com")
	if hdr.Get("Access-Control-Allow-Origin") != "https://app.example.com" {
		t.Fatalf("listed origin must be echoed, got %q", hdr.Get("Access-Control-Allow-Origin"))
	}
	if hdr.Get("Vary") != "Origin" {
		t.Fatalf("specific origin must add Vary: Origin, got %q", hdr.Get("Vary"))
	}
	_, hdr = corsHeaders(t, h, "GET", "https://evil.example")
	if v := hdr.Get("Access-Control-Allow-Origin"); v != "" {
		t.Fatalf("unlisted origin must get no header, got %q", v)
	}
	code, _ := corsHeaders(t, h, "OPTIONS", "https://evil.example")
	if code == 204 {
		t.Fatalf("unlisted preflight must not be short-circuited")
	}
}
