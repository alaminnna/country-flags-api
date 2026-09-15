package api

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"flagsapi/internal/meta"
	"flagsapi/internal/resolver"
)

func testServer(t *testing.T) *Server {
	t.Helper()
	assets := filepath.Join("..", "..", "assets")
	m, err := meta.Load(assets)
	if err != nil {
		t.Fatalf("meta: %v", err)
	}
	idx, err := resolver.Build(assets)
	if err != nil {
		t.Fatalf("resolver: %v", err)
	}
	return New(m, idx)
}

func TestHeaderPolicy(t *testing.T) {
	s := testServer(t)

	// resolver image: cache, etag, content-location, vary; no gzip
	req := httptest.NewRequest("GET", "/api/flags/bd?size=320&format=webp", nil)
	rec := httptest.NewRecorder()
	// route manually: PathValue needs mux; use real mux
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/flags/{code}", s.Flags)
	mux.ServeHTTP(rec, req)
	res := rec.Result()
	if res.StatusCode != 200 {
		t.Fatalf("status %d", res.StatusCode)
	}
	if ct := res.Header.Get("Content-Type"); ct != "image/webp" {
		t.Fatalf("ct %q", ct)
	}
	if cc := res.Header.Get("Cache-Control"); !strings.Contains(cc, "max-age=86400") {
		t.Fatalf("cc %q", cc)
	}
	if res.Header.Get("ETag") == "" {
		t.Fatalf("missing etag")
	}
	if res.Header.Get("Content-Location") == "" {
		t.Fatalf("missing content-location")
	}
	if res.Header.Get("Vary") != "Accept" {
		t.Fatalf("vary %q", res.Header.Get("Vary"))
	}
	if ce := res.Header.Get("Content-Encoding"); ce != "" {
		t.Fatalf("image must not be compressed, got %q", ce)
	}

	// canonical immutable
	req2 := httptest.NewRequest("GET", "/assets/v1/images/w320/bd.png", nil)
	rec2 := httptest.NewRecorder()
	mux2 := http.NewServeMux()
	mux2.HandleFunc("GET /assets/v1/", s.CanonicalAssets)
	mux2.ServeHTTP(rec2, req2)
	if cc := rec2.Result().Header.Get("Cache-Control"); !strings.Contains(cc, "immutable") {
		t.Fatalf("canonical cc %q", cc)
	}

	// traversal blocked (ServeMux may clean/redirect; must never be 200 with a body)
	req3 := httptest.NewRequest("GET", "/assets/v1/../../go.mod", nil)
	rec3 := httptest.NewRecorder()
	mux2.ServeHTTP(rec3, req3)
	if rec3.Code == 200 {
		t.Fatalf("traversal must never return 200")
	}

	// precomputed gzip: raw vs gz differ, gz served when accepted
	req4 := httptest.NewRequest("GET", "/api/v1/countries", nil)
	req4.Header.Set("Accept-Encoding", "gzip")
	rec4 := httptest.NewRecorder()
	s.Countries(rec4, req4)
	if ce := rec4.Result().Header.Get("Content-Encoding"); ce != "gzip" {
		t.Fatalf("want precomputed gzip, got %q", ce)
	}

	// 304 revalidation
	etag := res.Header.Get("ETag")
	req5 := httptest.NewRequest("GET", "/api/flags/bd?size=320&format=webp", nil)
	req5.Header.Set("If-None-Match", etag)
	rec5 := httptest.NewRecorder()
	mux.ServeHTTP(rec5, req5)
	if rec5.Code != http.StatusNotModified {
		t.Fatalf("want 304, got %d", rec5.Code)
	}

	// error shapes
	req6 := httptest.NewRequest("GET", "/api/flags/xx?size=320", nil)
	rec6 := httptest.NewRecorder()
	mux.ServeHTTP(rec6, req6)
	if rec6.Code != 404 || !strings.Contains(rec6.Body.String(), "country_not_found") {
		t.Fatalf("404 shape: %d %s", rec6.Code, rec6.Body.String())
	}
	req7 := httptest.NewRequest("GET", "/api/flags/bd?format=bmp", nil)
	rec7 := httptest.NewRecorder()
	mux.ServeHTTP(rec7, req7)
	if rec7.Code != 400 {
		t.Fatalf("want 400, got %d", rec7.Code)
	}
}
