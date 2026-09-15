package config

import (
	"bytes"
	"encoding/json"
	"flag"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

// CorsConfig controls cross-origin behavior.
// Zero value from JSON (section absent) resolves to the permissive default.
type CorsConfig struct {
	Enabled        bool     `json:"enabled"`
	AllowedOrigins []string `json:"allowed_origins"`
	MaxAgeSeconds  int      `json:"max_age_seconds"`
}

func defaultCors() CorsConfig {
	return CorsConfig{Enabled: true, AllowedOrigins: []string{"*"}, MaxAgeSeconds: 86400}
}

// fileConfig mirrors the optional JSON config file. Pointers distinguish
// "absent" (keep default) from an explicit zero value. Unknown fields are ignored.
type fileConfig struct {
	Cors      *fileCorsConfig      `json:"cors"`
	RateLimit *fileRateLimitConfig `json:"rate_limit"`
}

type fileCorsConfig struct {
	Enabled        *bool    `json:"enabled"`
	AllowedOrigins []string `json:"allowed_origins"`
	MaxAgeSeconds  *int     `json:"max_age_seconds"`
}

type fileRateLimitConfig struct {
	Enabled           *bool    `json:"enabled"`
	RequestsPerMinute *float64 `json:"requests_per_minute"`
	Burst             *int     `json:"burst"`
}

// Config holds all runtime configuration via flags + env.
type Config struct {
	AssetsDir  string
	Addr       string
	Domain     string
	RateLimit  float64 // requests per second per IP; 0 disables
	Burst      int
	Warm       bool
	CertDir    string
	ConfigFile string
	Cors       CorsConfig
}

// Load parses flags and env vars (env wins if flag left at default? we apply env override when flag not explicitly set is complex;
// simple rule: env var overrides default when set).
// Precedence: built-in defaults < config file < flags < env.
func Load(args []string) *Config {
	c := &Config{Cors: defaultCors()}
	fs := flag.NewFlagSet("flagsapi", flag.ContinueOnError)
	fs.StringVar(&c.AssetsDir, "assets", "./assets", "path to assets directory")
	fs.StringVar(&c.Addr, "addr", ":8080", "listen address")
	fs.StringVar(&c.Domain, "domain", "", "domain for autocert TLS (empty = plain HTTP)")
	fs.Float64Var(&c.RateLimit, "ratelimit", 200.0/60.0, "rate limit in req/sec per IP (0 disables)")
	fs.IntVar(&c.Burst, "burst", 100, "rate limit burst per IP")
	fs.BoolVar(&c.Warm, "warm", true, "background page-cache warmup")
	fs.StringVar(&c.CertDir, "certdir", "./data/certs", "autocert cert cache dir")
	fs.StringVar(&c.ConfigFile, "config", "config.json", "path to JSON config file (optional)")
	corsFlag := fs.String("cors", "", "CORS override: on|off (empty = use config file)")
	_ = fs.Parse(args)

	set := map[string]bool{}
	fs.Visit(func(f *flag.Flag) { set[f.Name] = true })

	applyFileConfig(c, set)

	if *corsFlag != "" {
		c.Cors.Enabled = !isOff(*corsFlag)
	}

	if v := os.Getenv("FLAGS_ASSETS_DIR"); v != "" {
		c.AssetsDir = v
	}
	if v := os.Getenv("FLAGS_ADDR"); v != "" {
		c.Addr = v
	}
	if v := os.Getenv("FLAGS_DOMAIN"); v != "" {
		c.Domain = v
	}
	if v := os.Getenv("FLAGS_RATELIMIT"); v != "" {
		// accepts "200/min", "3.3/s" or plain float (req/sec). "0"/"off" disables.
		if isOff(v) {
			c.RateLimit = 0
		} else if strings.HasSuffix(v, "/min") {
			if f, err := strconv.ParseFloat(strings.TrimSuffix(v, "/min"), 64); err == nil {
				c.RateLimit = f / 60.0
			}
		} else if strings.HasSuffix(v, "/s") {
			if f, err := strconv.ParseFloat(strings.TrimSuffix(v, "/s"), 64); err == nil {
				c.RateLimit = f
			}
		} else if f, err := strconv.ParseFloat(v, 64); err == nil {
			c.RateLimit = f
		}
	}
	if v := os.Getenv("FLAGS_BURST"); v != "" {
		if b, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			c.Burst = b
		}
	}
	if v := os.Getenv("FLAGS_WARM"); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			c.Warm = b
		}
	}
	if v := os.Getenv("FLAGS_CERT_DIR"); v != "" {
		c.CertDir = v
	}
	if v := os.Getenv("FLAGS_CORS"); v != "" {
		c.Cors.Enabled = !isOff(v)
	}
	if v := os.Getenv("FLAGS_CORS_ORIGINS"); v != "" {
		var origins []string
		for _, o := range strings.Split(v, ",") {
			if o = strings.TrimSpace(o); o != "" {
				origins = append(origins, o)
			}
		}
		c.Cors.AllowedOrigins = origins
	}
	return c
}

func isOff(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "0", "off", "false", "no", "disable", "disabled":
		return true
	}
	return false
}

// applyFileConfig merges the JSON config file into c. Values from explicitly
// set flags win over the file. A missing file is normal (defaults apply);
// an explicit -config path that cannot be read, or invalid JSON, warns loudly.
func applyFileConfig(c *Config, set map[string]bool) {
	data, err := os.ReadFile(c.ConfigFile)
	if err != nil {
		if set["config"] {
			slog.Warn("config file not found", "path", c.ConfigFile)
		}
		return
	}
	// tolerate a UTF-8 BOM (Windows editors like Notepad add one)
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	var fc fileConfig
	if err := json.Unmarshal(data, &fc); err != nil {
		slog.Warn("config file invalid, using defaults", "path", c.ConfigFile, "err", err)
		return
	}
	if fc.Cors == nil && fc.RateLimit == nil {
		return
	}
	if fc.Cors != nil {
		if fc.Cors.Enabled != nil && !set["cors"] {
			c.Cors.Enabled = *fc.Cors.Enabled
		}
		if fc.Cors.AllowedOrigins != nil {
			c.Cors.AllowedOrigins = fc.Cors.AllowedOrigins
		}
		if fc.Cors.MaxAgeSeconds != nil {
			c.Cors.MaxAgeSeconds = *fc.Cors.MaxAgeSeconds
		}
	}
	if fc.RateLimit != nil {
		rl := fc.RateLimit
		if rl.Enabled != nil && !*rl.Enabled {
			c.RateLimit = 0
		} else if rl.RequestsPerMinute != nil && !set["ratelimit"] {
			c.RateLimit = *rl.RequestsPerMinute / 60.0
		}
		if rl.Burst != nil && !set["burst"] {
			c.Burst = *rl.Burst
		}
	}
	slog.Info("config file loaded", "path", c.ConfigFile,
		"cors_enabled", c.Cors.Enabled, "ratelimit_per_sec", c.RateLimit, "burst", c.Burst)
}
