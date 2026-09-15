package meta

import (
	"path/filepath"
	"testing"
)

func loadTest(t *testing.T) *Store {
	t.Helper()
	s, err := Load(filepath.Join("..", "..", "assets"))
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	return s
}

func TestLoadCount(t *testing.T) {
	s := loadTest(t)
	if len(s.All) != 254 {
		t.Fatalf("want 254, got %d", len(s.All))
	}
	// sorted by name
	for i := 1; i < len(s.All); i++ {
		if s.All[i-1].Name > s.All[i].Name {
			t.Fatalf("not sorted: %q > %q", s.All[i-1].Name, s.All[i].Name)
		}
	}
	if len(s.ListJSON) == 0 || len(s.ListJSONGZ) == 0 {
		t.Fatalf("precomputed list missing")
	}
}

func TestLookupVariants(t *testing.T) {
	s := loadTest(t)
	for _, code := range []string{"bd", "BD", "bgd", "BGD", "050", "50"} {
		if _, ok := s.LookupCode(code); !ok {
			t.Fatalf("lookup %q failed", code)
		}
	}
	c, ok := s.LookupCode("BGD")
	if !ok || c.Code != "bd" {
		t.Fatalf("BGD -> %+v", c)
	}
	if _, ok := s.LookupCode("gb-eng"); !ok {
		t.Fatalf("gb-eng lookup failed")
	}
	if _, ok := s.LookupCode("xk"); !ok {
		t.Fatalf("xk lookup failed")
	}
	if _, ok := s.LookupCode("xx"); ok {
		t.Fatalf("xx should miss")
	}
}

func TestSearch(t *testing.T) {
	s := loadTest(t)
	if got := s.Search("bangla"); len(got) != 1 || got[0].Code != "bd" {
		t.Fatalf("search bangla: %+v", got)
	}
	if got := s.Search("usa"); len(got) == 0 {
		t.Fatalf("search usa (alias) empty")
	}
	if got := s.Search(""); len(got) != 0 {
		t.Fatalf("empty search should be empty")
	}
}

func TestNormalize(t *testing.T) {
	if Normalize("Côte d'Ivoire") != "cote divoire" {
		t.Fatalf("fold: %q", Normalize("Côte d'Ivoire"))
	}
}
