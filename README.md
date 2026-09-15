# country-flags-api

<p align="center">
  <img src="docs/device-shot.png" alt="Flags API — Country flags served at RAM speed, responsive on laptop and mobile" width="100%" />
</p>

<h1 align="center">Flags API</h1>

<p align="center">
  <strong>Country flags, served at RAM speed.</strong><br/>
  Metadata + flag assets for 254 countries.<br/>
  One Go binary. Zero-copy delivery. Immutable caching.
</p>

<p align="center">
  <a href="https://country-flags-api.vercel.app">Website</a> ·
  <a href="https://country-flags-api.vercel.app/docs">API Docs</a> ·
  <a href="https://country-flags-api.vercel.app/explore">Explore</a> ·
  <a href="https://country-flags-api.vercel.app/playground">Playground</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/github/license/alaminnna/country-flags-api" alt="License" />
  <img src="https://img.shields.io/badge/254-countries-green" alt="Countries" />
  <img src="https://img.shields.io/badge/26%2C162-variants-blue" alt="Variants" />
</p>

---

## What this is

A free API that serves country flags and metadata. No database. No Node.js in production. No runtime image processing. Just one Go binary doing what it's good at — reading files off disk and sending them to you fast.

**254 countries. 26,162 flag variants** (SVG, WebP, PNG, JPG, PDF, AI, EPS). Every file already exists on disk. The server is just a really efficient middleman.

## Quickstart

```bash
# Clone and run
git clone https://github.com/alaminnna/country-flags-api.git
cd country-flags-api
go run ./cmd/flagsapi -assets ./assets
```

That's it. API is live on `:8080`.

```bash
# Get a flag
curl localhost:8080/api/flags/bd?size=320&format=webp --output bd.webp

# Get country metadata
curl localhost:8080/api/v1/countries/BGD

# List all countries
curl localhost:8080/api/v1/countries
```

### Frontend dev

```bash
make dev   # Go on :8080, Next.js on :3000
```

## How it works

```
┌────────────────────────────────────────────────────────────┐
│                    SINGLE GO BINARY                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Metadata API │  │ Flag         │  │ Static UI        │  │
│  │ (in-memory,  │  │ Resolver     │  │ (Next.js static  │  │
│  │  precomputed │  │ (index →     │  │  export, go:embed│  │
│  │  responses)  │  │  local file) │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│              net/http :443 (HTTP/2, autocert TLS)           │
└────────────────────────────┬───────────────────────────────┘
                             │ open → stat → sendfile (zero-copy)
                             ▼
                  assets/  (0.54 GB, on disk,
                           backed by Linux page cache)
```

The resolver is a pure map lookup. No image processing, no resizing, no format conversion per request. All 26,162 variants are pre-generated and sitting on disk. The server just picks the right file and uses `sendfile` to push it to you.

## Endpoints

| Route | What it does |
|---|---|
| `GET /api/v1/countries` | Full list (JSON array, alpha-sorted) |
| `GET /api/v1/countries/{code}` | ISO2 / ISO3 / numeric, any case |
| `GET /api/v1/countries/{code}/assets` | Per-country asset manifest |
| `GET /api/v1/assets` | Global manifest: counts, sizes, bytes |
| `GET /api/flags/{code}` | Smart resolver with format/size negotiation |
| `GET /assets/v1/...` | Canonical immutable file passthrough |
| `GET /healthz` | Health check |
| `GET /readyz` | Readiness check |

### Resolver params

```bash
curl localhost:8080/api/flags/bd?size=320&format=webp
curl localhost:8080/api/flags/jp?type=icon&size=64
curl localhost:8080/api/flags/us?download=1
```

| Param | Options | Default |
|---|---|---|
| `type` | `image`, `icon` | `image` |
| `format` | `svg`, `webp`, `png`, `jpg`, `pdf`, `ai`, `eps` | negotiates via `Accept` |
| `size` | `N` (width), `WxH` | best available |
| `download` | `1` | — |

No `format=` + `Accept: image/webp` → WebP automatically. AVIF is intentionally not generated.

## Caching

- `/assets/v1/*` — `max-age=31536000, immutable`. Bump `v1` to invalidate everything.
- `/api/flags/*` — `max-age=86400, stale-while-revalidate=604800` + `Vary: Accept`.
- `/api/v1/countries*` — `max-age=3600, stale-while-revalidate=86400`.
- `ETag` + `ServeContent` — free 304s, Range/206, HEAD.
- gzip only for JSON/SVG/text. PNG/WebP/JPG/PDF never compressed (preserves `sendfile`).

## Performance

| Check | Result |
|---|---|
| Boot → ready (254 countries, 26,162 files) | **858 ms** |
| `GET /api/flags/bd?size=320&format=webp` | 200, `image/webp`, ETag |
| Conditional request | 304 |
| Range on PDF | 206 |
| RSS after boot | **~27 MB** |
| `go test ./...` | all pass |

## Features

- **254 countries** — ISO2, ISO3, numeric codes all resolve
- **7 formats** — SVG, WebP, PNG, JPG, PDF, AI, EPS
- **26,162 variants** — every size and format pre-generated
- **Zero-copy delivery** — `sendfile` straight from disk
- **Immutable caching** — versioned assets, never purged
- **Smart resolver** — format negotiation, size selection, download mode
- **Open CORS** — ready to use from any frontend
- **Quiz** — test your flag knowledge
- **Duel mode** — challenge a friend (stateless, link-based)
- **Compare** — side-by-side country comparison
- **Dark mode** — because it's 2026

## Why no database / no SSR / no runtime image processing

**No database:** 254 static records. Everything fits in memory. Indexes + precomputed JSON responses serve every hot path with a `memcpy`. A database would add I/O and operational complexity for zero product gain.

**No SSR:** The landing page, docs, explorer are static shells. 254 country pages pre-render at build time. 254-item search runs client-side. Adding a Node runtime for this would be pointless.

**No runtime image processing:** All 26,162 variants already exist on disk. The resolver is `open → stat → sendfile`. Resizing per request would burn CPU to recreate bytes we already have.

## Deploy

```bash
# Simple
git clone && ./deploy/deploy.sh
# That's it. systemd + CAP_NET_BIND_SERVICE.

# Docker
docker compose -f deploy/docker-compose.yml up -d

# With TLS
./bin/flagsapi -domain example.com -assets ./assets
# In-process Let's Encrypt autocert (:80 HTTP-01 + redirect, :443 HTTP/2)
```

**Oracle Cloud Always Free** (Ampere A1, 10 TB egress) handles this comfortably. Or any $4 VPS.

Optional: Cloudflare proxy in front caches immutable `/assets/v1/*` for free.

## Project structure

```
cmd/flagsapi        Go entrypoint
internal/config     flags + env
internal/meta       country load, indexes, precomputed JSON+gzip
internal/resolver   asset index + size/format negotiation
internal/api        handlers, manifests, headers
internal/httpx      CORS, security headers, rate limit, logging
internal/ui         go:embed of web/out
web/                Next.js App Router, static export
deploy/             Dockerfile, compose, systemd, Caddyfile
assets/             READ-ONLY input (never written by server)
```

## License

MIT

---

<p align="center">
  Built by <a href="https://github.com/alaminnna">Al A Min</a>
</p>
