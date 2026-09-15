package config

import (
	"os"
	"path/filepath"
	"testing"
)

func neutralEnv(t *testing.T) {
	t.Helper()
	for _, k := range []string{"FLAGS_ASSETS_DIR", "FLAGS_ADDR", "FLAGS_DOMAIN", "FLAGS_RATELIMIT", "FLAGS_BURST", "FLAGS_WARM", "FLAGS_CERT_DIR", "FLAGS_CORS", "FLAGS_CORS_ORIGINS"} {
		t.Setenv(k, "")
	}
}

func writeTempConfig(t *testing.T, body string) string {
	t.Helper()
	p := filepath.Join(t.TempDir(), "config.json")
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestLoadDefaultsWithoutFile(t *testing.T) {
	neutralEnv(t)
	c := Load([]string{"-config", filepath.Join(t.TempDir(), "missing.json")})
	if !c.Cors.Enabled {
		t.Fatalf("default cors must be enabled")
	}
	if len(c.Cors.AllowedOrigins) != 1 || c.Cors.AllowedOrigins[0] != "*" {
		t.Fatalf("default cors origins=%v", c.Cors.AllowedOrigins)
	}
	if c.RateLimit <= 0 || c.Burst != 100 {
		t.Fatalf("default ratelimit=%v burst=%v", c.RateLimit, c.Burst)
	}
}

func TestLoadFileCorsAndRateLimit(t *testing.T) {
	neutralEnv(t)
	p := writeTempConfig(t, `{
		"cors": {"enabled": false, "allowed_origins": ["https://app.example.com"], "max_age_seconds": 60},
		"rate_limit": {"enabled": true, "requests_per_minute": 120, "burst": 50}
	}`)
	c := Load([]string{"-config", p})
	if c.Cors.Enabled {
		t.Fatalf("file must disable cors")
	}
	if len(c.Cors.AllowedOrigins) != 1 || c.Cors.AllowedOrigins[0] != "https://app.example.com" {
		t.Fatalf("origins=%v", c.Cors.AllowedOrigins)
	}
	if c.Cors.MaxAgeSeconds != 60 {
		t.Fatalf("maxage=%v", c.Cors.MaxAgeSeconds)
	}
	if c.RateLimit != 2.0 {
		t.Fatalf("120/min must become 2/sec, got %v", c.RateLimit)
	}
	if c.Burst != 50 {
		t.Fatalf("burst=%v", c.Burst)
	}
}

func TestLoadFileRateLimitDisabled(t *testing.T) {
	neutralEnv(t)
	p := writeTempConfig(t, `{"rate_limit": {"enabled": false, "requests_per_minute": 600}}`)
	c := Load([]string{"-config", p})
	if c.RateLimit != 0 {
		t.Fatalf("disabled rate limit must be 0, got %v", c.RateLimit)
	}
}

func TestLoadFlagsOverrideFile(t *testing.T) {
	neutralEnv(t)
	p := writeTempConfig(t, `{"cors": {"enabled": false}, "rate_limit": {"requests_per_minute": 60, "burst": 10}}`)
	c := Load([]string{"-config", p, "-cors", "on", "-ratelimit", "9", "-burst", "11"})
	if !c.Cors.Enabled {
		t.Fatalf("explicit -cors on must win over file")
	}
	if c.RateLimit != 9 || c.Burst != 11 {
		t.Fatalf("explicit flags must win: ratelimit=%v burst=%v", c.RateLimit, c.Burst)
	}
}

func TestLoadInvalidJSONKeepsDefaults(t *testing.T) {
	neutralEnv(t)
	p := writeTempConfig(t, `{not json`)
	c := Load([]string{"-config", p})
	if !c.Cors.Enabled || c.RateLimit <= 0 {
		t.Fatalf("invalid file must keep defaults: %+v", c.Cors)
	}
}
