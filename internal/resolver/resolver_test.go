package resolver

import (
	"path/filepath"
	"testing"
)

func testIndex(t *testing.T) *Index {
	t.Helper()
	idx, err := Build(filepath.Join("..", "..", "assets"))
	if err != nil {
		t.Fatalf("build: %v", err)
	}
	return idx
}

func TestIndexCounts(t *testing.T) {
	idx := testIndex(t)
	if len(idx.ByCode) != 254 {
		t.Fatalf("want 254 countries, got %d", len(idx.ByCode))
	}
	if got := len(idx.AllRelPaths); got != 26162 {
		t.Fatalf("want 26162 files, got %d", got)
	}
}

func TestSizePicking(t *testing.T) {
	idx := testIndex(t)
	// exact
	r, rerr := idx.Resolve("bd", ResolveOptions{Type: "image", Format: "png", Size: "320"})
	if rerr != nil {
		t.Fatalf("resolve: %v", rerr)
	}
	if r.Variant.W != 320 {
		t.Fatalf("want W=320, got %+v", r.Variant)
	}
	// smallest >= requested: 321 -> w640 (h-sizes max out at 240, so unambiguous)
	r, rerr = idx.Resolve("bd", ResolveOptions{Type: "image", Format: "png", Size: "321"})
	if rerr != nil {
		t.Fatalf("resolve: %v", rerr)
	}
	if r.Variant.W != 640 {
		t.Fatalf("want W=640, got %+v", r.Variant)
	}
	// larger than max -> largest (2560)
	r, rerr = idx.Resolve("bd", ResolveOptions{Type: "image", Format: "png", Size: "99999"})
	if rerr != nil {
		t.Fatalf("resolve: %v", rerr)
	}
	if r.Variant.W != 2560 {
		t.Fatalf("want W=2560, got %+v", r.Variant)
	}
	// WxH icon exact
	r, rerr = idx.Resolve("bd", ResolveOptions{Type: "icon", Format: "png", Size: "80x60"})
	if rerr != nil {
		t.Fatalf("resolve: %v", rerr)
	}
	if r.Variant.W != 80 || r.Variant.H != 60 {
		t.Fatalf("want 80x60, got %+v", r.Variant)
	}
	// vector
	r, rerr = idx.Resolve("bd", ResolveOptions{Type: "vector", Format: "svg"})
	if rerr != nil {
		t.Fatalf("resolve: %v", rerr)
	}
	if r.Kind != "vector" {
		t.Fatalf("want vector kind, got %s", r.Kind)
	}
}

func TestNegotiation(t *testing.T) {
	idx := testIndex(t)
	r, rerr := idx.Resolve("bd", ResolveOptions{Type: "image", Size: "320", Accept: "image/webp,image/*,*/*"})
	if rerr != nil {
		t.Fatalf("resolve: %v", rerr)
	}
	if r.Format != "webp" {
		t.Fatalf("want webp negotiation, got %s", r.Format)
	}
	if !r.Negotiated {
		t.Fatalf("want Negotiated=true")
	}
}

func TestInvalidInputs(t *testing.T) {
	idx := testIndex(t)
	if _, rerr := idx.Resolve("xx", ResolveOptions{Type: "image", Format: "png", Size: "320"}); rerr == nil || rerr.Status != 404 {
		t.Fatalf("want 404 for unknown code, got %v", rerr)
	}
	if _, rerr := idx.Resolve("bd", ResolveOptions{Type: "bogus", Format: "png", Size: "320"}); rerr == nil || rerr.Status != 400 {
		t.Fatalf("want 400 for bad type, got %v", rerr)
	}
	if _, rerr := idx.Resolve("bd", ResolveOptions{Type: "image", Format: "bmp", Size: "320"}); rerr == nil || rerr.Status != 400 {
		t.Fatalf("want 400 for bad format, got %v", rerr)
	}
	if _, rerr := idx.Resolve("bd", ResolveOptions{Type: "image", Format: "png", Size: "abc"}); rerr == nil || rerr.Status != 400 {
		t.Fatalf("want 400 for bad size, got %v", rerr)
	}
	// gb-eng + xk resolve
	if _, rerr := idx.Resolve("gb-eng", ResolveOptions{Type: "image", Format: "png", Size: "320"}); rerr != nil {
		t.Fatalf("gb-eng: %v", rerr)
	}
	if _, rerr := idx.Resolve("xk", ResolveOptions{Type: "image", Format: "png", Size: "320"}); rerr != nil {
		t.Fatalf("xk: %v", rerr)
	}
}
