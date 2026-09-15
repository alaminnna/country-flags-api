package api

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"flagsapi/internal/meta"
	"flagsapi/internal/resolver"
)

// Server holds dependencies and precomputed payloads.
type Server struct {
	Meta *meta.Store
	Idx  *resolver.Index

	manifestOne   map[string][]byte // iso2 -> raw json
	manifestOneGZ map[string][]byte
	globalRaw     []byte
	globalGZ      []byte
	ready         bool
	mu            sync.RWMutex
}

// AssetEntry is one row in a manifest.
type AssetEntry struct {
	Type   string `json:"type"` // image|icon|vector
	Format string `json:"format"`
	Size   string `json:"size"` // "320" or "80x60" or "-" for vectors
	URL    string `json:"url"`  // canonical immutable URL
	Bytes  int64  `json:"bytes"`
	Width  int    `json:"width,omitempty"`
	Height int    `json:"height,omitempty"`
}

// GlobalManifest summarizes the corpus.
type GlobalManifest struct {
	Countries  int            `json:"countries"`
	TotalFiles int            `json:"total_files"`
	TotalBytes int64          `json:"total_bytes"`
	ByKind     map[string]int `json:"by_kind"`
	ByFormat   map[string]int `json:"by_format"`
	ImageSizes []string       `json:"image_sizes"`
	IconSizes  []string       `json:"icon_sizes"`
}

var contentTypes = map[string]string{
	".svg":  "image/svg+xml",
	".webp": "image/webp",
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".pdf":  "application/pdf",
	".eps":  "application/postscript",
	".ai":   "application/postscript",
	".json": "application/json",
}

// New builds Server and precomputes manifests.
func New(m *meta.Store, idx *resolver.Index) *Server {
	s := &Server{Meta: m, Idx: idx,
		manifestOne: make(map[string][]byte), manifestOneGZ: make(map[string][]byte)}
	s.buildManifests()
	s.mu.Lock()
	s.ready = true
	s.mu.Unlock()
	return s
}

func (s *Server) Ready() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ready
}

func canonicalURL(rel string) string {
	return "/assets/v1/" + rel
}

func (s *Server) buildManifests() {
	// per-country
	for iso2, ca := range s.Idx.ByCode {
		var entries []AssetEntry
		for format, vs := range ca.Images {
			for _, v := range vs {
				var size string
				if v.W > 0 && v.H > 0 {
					size = fmt.Sprintf("%dx%d", v.W, v.H)
				} else if v.W > 0 {
					size = strconv.Itoa(v.W)
				} else {
					size = strconv.Itoa(v.H)
				}
				entries = append(entries, AssetEntry{
					Type: "image", Format: format, Size: size,
					URL: canonicalURL(v.Path), Bytes: v.Size, Width: v.W, Height: v.H,
				})
			}
		}
		for format, vs := range ca.Icons {
			for _, v := range vs {
				entries = append(entries, AssetEntry{
					Type: "icon", Format: format, Size: fmt.Sprintf("%dx%d", v.W, v.H),
					URL: canonicalURL(v.Path), Bytes: v.Size, Width: v.W, Height: v.H,
				})
			}
		}
		for format, p := range ca.Vectors {
			var sz int64
			if fi, err := os.Stat(s.Idx.AbsPath(p)); err == nil {
				sz = fi.Size()
			}
			entries = append(entries, AssetEntry{
				Type: "vector", Format: format, Size: "-",
				URL: canonicalURL(p), Bytes: sz,
			})
		}
		sort.Slice(entries, func(i, j int) bool {
			if entries[i].Type != entries[j].Type {
				return entries[i].Type < entries[j].Type
			}
			if entries[i].Format != entries[j].Format {
				return entries[i].Format < entries[j].Format
			}
			return entries[i].Size < entries[j].Size
		})
		raw, _ := json.Marshal(entries)
		s.manifestOne[iso2] = raw
		s.manifestOneGZ[iso2] = gzipBytes(raw)
	}
	// global
	byFmt := map[string]int{}
	for _, ca := range s.Idx.ByCode {
		for f, vs := range ca.Images {
			byFmt[f] += len(vs)
		}
		for f, vs := range ca.Icons {
			byFmt[f] += len(vs)
		}
		for f := range ca.Vectors {
			byFmt[f]++
		}
	}
	imgSet, iconSet := map[string]bool{}, map[string]bool{}
	for _, ca := range s.Idx.ByCode {
		for _, vs := range ca.Images {
			for _, v := range vs {
				var k string
				if v.W > 0 && v.H == 0 {
					k = fmt.Sprintf("w%d", v.W)
				} else if v.H > 0 && v.W == 0 {
					k = fmt.Sprintf("h%d", v.H)
				} else {
					k = fmt.Sprintf("%dx%d", v.W, v.H)
				}
				imgSet[k] = true
			}
		}
		for _, vs := range ca.Icons {
			for _, v := range vs {
				iconSet[fmt.Sprintf("%dx%d", v.W, v.H)] = true
			}
		}
		break // sizes identical across countries; one sample suffices
	}
	g := GlobalManifest{
		Countries:  len(s.Meta.All),
		TotalFiles: len(s.Idx.AllRelPaths),
		TotalBytes: s.Idx.TotalBytes,
		ByKind:     s.Idx.CountByKind,
		ByFormat:   byFmt,
	}
	for k := range imgSet {
		g.ImageSizes = append(g.ImageSizes, k)
	}
	for k := range iconSet {
		g.IconSizes = append(g.IconSizes, k)
	}
	sort.Strings(g.ImageSizes)
	sort.Strings(g.IconSizes)
	s.globalRaw, _ = json.Marshal(g)
	s.globalGZ = gzipBytes(s.globalRaw)
}

func gzipBytes(src []byte) []byte {
	var buf bytes.Buffer
	w, _ := gzip.NewWriterLevel(&buf, 5)
	_, _ = w.Write(src)
	_ = w.Close()
	return buf.Bytes()
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, r *http.Request, raw, gz []byte, cache string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", cache)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if acceptsGzip(r) && len(gz) > 0 {
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Content-Length", strconv.Itoa(len(gz)))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(gz)
		return
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(raw)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func acceptsGzip(r *http.Request) bool {
	return strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")
}

func writeErr(w http.ResponseWriter, status int, code, msg string, extra map[string]interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	body := map[string]interface{}{"error": map[string]interface{}{"code": code, "message": msg}}
	if extra != nil {
		for k, v := range extra {
			body["error"].(map[string]interface{})[k] = v
		}
	}
	_ = json.NewEncoder(w).Encode(body)
}

// --- handlers ---

// Countries handles GET /api/v1/countries with ?search= ?region=.
func (s *Server) Countries(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	search := strings.TrimSpace(q.Get("search"))
	region := strings.TrimSpace(q.Get("region"))
	if search == "" && region == "" {
		writeJSON(w, r, s.Meta.ListJSON, s.Meta.ListJSONGZ, "public, max-age=3600, stale-while-revalidate=86400")
		return
	}
	var filtered []*meta.Country
	if region != "" {
		rl := strings.ToLower(region)
		for _, c := range s.Meta.All {
			if strings.ToLower(c.Meta.Continent) == rl {
				filtered = append(filtered, c)
			}
		}
		if search != "" {
			var f2 []*meta.Country
			nq := meta.Normalize(search)
			for _, c := range filtered {
				if strings.Contains(meta.Normalize(c.Name), nq) ||
					strings.Contains(meta.Normalize(c.Meta.OfficialName), nq) ||
					strings.Contains(strings.ToLower(c.Code), nq) {
					f2 = append(f2, c)
				}
			}
			filtered = f2
		}
	} else {
		filtered = s.Meta.Search(search)
	}
	if filtered == nil {
		filtered = []*meta.Country{}
	}
	raw, _ := json.Marshal(filtered)
	// dynamic: gzip on the fly only if client accepts and content is json
	if acceptsGzip(r) {
		var buf bytes.Buffer
		zw, _ := gzip.NewWriterLevel(&buf, 5)
		_, _ = zw.Write(raw)
		_ = zw.Close()
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		_, _ = w.Write(buf.Bytes())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	_, _ = w.Write(raw)
}

// CountryOne handles GET /api/v1/countries/{code}.
func (s *Server) CountryOne(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	c, ok := s.Meta.LookupCode(code)
	if !ok {
		writeErr(w, 404, "country_not_found", "unknown country code: "+code, nil)
		return
	}
	iso2 := strings.ToLower(c.Code)
	writeJSON(w, r, s.Meta.OneJSON[iso2], s.Meta.OneJSONGZ[iso2], "public, max-age=3600, stale-while-revalidate=86400")
}

// CountryAssets handles GET /api/v1/countries/{code}/assets.
func (s *Server) CountryAssets(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	c, ok := s.Meta.LookupCode(code)
	if !ok {
		writeErr(w, 404, "country_not_found", "unknown country code: "+code, nil)
		return
	}
	iso2 := strings.ToLower(c.Code)
	raw, ok := s.manifestOne[iso2]
	if !ok {
		writeErr(w, 404, "variant_not_found", "no assets indexed for "+iso2, nil)
		return
	}
	writeJSON(w, r, raw, s.manifestOneGZ[iso2], "public, max-age=3600, stale-while-revalidate=86400")
}

// GlobalAssets handles GET /api/v1/assets.
func (s *Server) GlobalAssets(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, r, s.globalRaw, s.globalGZ, "public, max-age=3600, stale-while-revalidate=86400")
}

// Flags handles GET /api/flags/{code} and /api/v1/flags/{code}.
func (s *Server) Flags(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	c, ok := s.Meta.LookupCode(code)
	if !ok {
		writeErr(w, 404, "country_not_found", "unknown country code: "+code, nil)
		return
	}
	iso2 := strings.ToLower(c.Code)
	q := r.URL.Query()
	typ := strings.ToLower(strings.TrimSpace(q.Get("type")))
	format := strings.ToLower(strings.TrimSpace(q.Get("format")))
	size := strings.TrimSpace(q.Get("size"))
	if typ == "" {
		typ = "image"
		// vector formats imply vector
		if format == "svg" || format == "pdf" || format == "eps" || format == "ai" {
			typ = "vector"
		}
	}
	// defaults per spec
	if size == "" {
		if typ == "icon" {
			size = "64"
		} else if typ == "image" {
			size = "320"
		}
	}
	res, rerr := s.Idx.Resolve(iso2, resolver.ResolveOptions{
		Type: typ, Format: format, Size: size, Accept: r.Header.Get("Accept"),
	})
	if rerr != nil {
		extra := map[string]interface{}{}
		if len(rerr.AvailableFormats) > 0 {
			extra["available_formats"] = rerr.AvailableFormats
		}
		if len(rerr.AvailableSizes) > 0 {
			extra["available_sizes"] = rerr.AvailableSizes
		}
		writeErr(w, rerr.Status, rerr.Code, rerr.Message, extra)
		return
	}
	rel := res.RelPath
	if res.Kind == "vector" && res.VectorPath != "" {
		rel = res.VectorPath
	}
	abs := s.Idx.AbsPath(rel)
	// vector with empty format negotiation: Resolve already handled; ensure abs set
	if res.AbsPath != "" && res.RelPath == "" {
		abs = res.AbsPath
	}
	s.serveFile(w, r, abs, rel, "public, max-age=86400, stale-while-revalidate=604800", true, q.Get("download") == "1" || q.Get("download") == "true", iso2, size, res.Format)
}

// CanonicalAssets handles GET /assets/v1/... (passthrough).
func (s *Server) CanonicalAssets(w http.ResponseWriter, r *http.Request) {
	rel := strings.TrimPrefix(r.URL.Path, "/assets/v1/")
	// clean + prefix check: must be vectors/|images/|icons/|data/
	cleaned := filepath.ToSlash(filepath.Clean(rel))
	if strings.Contains(cleaned, "..") || strings.HasPrefix(cleaned, "/") {
		writeErr(w, 400, "invalid_path", "invalid asset path", nil)
		return
	}
	allowed := false
	for _, p := range []string{"vectors/", "images/", "icons/", "data/"} {
		if strings.HasPrefix(cleaned, p) {
			allowed = true
			break
		}
	}
	if !allowed {
		writeErr(w, 404, "not_found", "asset not found", nil)
		return
	}
	abs := filepath.Join(s.Idx.AssetsDir, filepath.FromSlash(cleaned))
	// ensure abs stays within assets dir
	absClean, _ := filepath.Abs(abs)
	rootClean, _ := filepath.Abs(s.Idx.AssetsDir)
	if !strings.HasPrefix(absClean, rootClean) {
		writeErr(w, 400, "invalid_path", "invalid asset path", nil)
		return
	}
	s.serveFile(w, r, abs, cleaned, "public, max-age=31536000, immutable", false, false, "", "", "")
}

func contentTypeFor(path string) string {
	ext := strings.ToLower(filepath.Ext(path))
	if ct, ok := contentTypes[ext]; ok {
		return ct
	}
	return "application/octet-stream"
}

// serveFile implements open → stat → headers → ServeContent.
func (s *Server) serveFile(w http.ResponseWriter, r *http.Request, abs, rel, cache string, varyAccept, download bool, code, size, format string) {
	f, err := os.Open(abs)
	if err != nil {
		writeErr(w, 404, "not_found", "asset file not found", nil)
		return
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil || fi.IsDir() {
		writeErr(w, 404, "not_found", "asset file not found", nil)
		return
	}
	ct := contentTypeFor(abs)
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Cache-Control", cache)
	w.Header().Set("ETag", fmt.Sprintf(`"%d-%d"`, fi.Size(), fi.ModTime().UnixNano()))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if varyAccept {
		w.Header().Set("Vary", "Accept")
	}
	if rel != "" {
		w.Header().Set("Content-Location", "/assets/v1/"+rel)
	}
	if download {
		ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(abs)), ".")
		if ext == "" {
			ext = "bin"
		}
		sz := size
		if sz == "" {
			sz = "default"
		}
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-flag-%s.%s"`, code, sz, ext))
	}
	// NOTE: never wrap in gzip writer here — preserves sendfile zero-copy.
	http.ServeContent(w, r, filepath.Base(abs), fi.ModTime(), f)
}

// Healthz / Readyz
func (s *Server) Healthz(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	_, _ = w.Write([]byte("ok"))
}

func (s *Server) Readyz(w http.ResponseWriter, r *http.Request) {
	if !s.Ready() {
		http.Error(w, "not ready", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "text/plain")
	_, _ = w.Write([]byte("ok"))
}
