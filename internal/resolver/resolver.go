// Package resolver builds an in-memory index of flag asset files at boot
// and resolves API requests to on-disk files with pure lookups.
package resolver

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Variant is one raster file.
type Variant struct {
	W    int    // width (for w-dirs and icons); for h-dirs this is 0 and H is set
	H    int    // height (for h-dirs and icons); for w-dirs this is 0
	Path string // relative to assets root, slash-separated (e.g. assets/images/w320/bd.png)
	Size int64  // file size in bytes (filled at boot)
}

// CountryAssets holds all variants for one country keyed by lowercase ISO2
// (including gb-eng, gb-sct, gb-wls, gb-nir, xk).
type CountryAssets struct {
	Images  map[string][]Variant // format(lower) -> sorted by effective size asc
	Icons   map[string][]Variant // format(lower) -> sorted by width asc
	Vectors map[string]string    // format(lower) -> rel path
}

// Index is the full resolver index. Read-only after Build.
type Index struct {
	AssetsDir string
	ByCode    map[string]*CountryAssets
	// AllRelPaths lists every indexed asset rel path (for warmup + manifest).
	AllRelPaths []string
	TotalBytes  int64
	CountByKind map[string]int // vector/image/icon
}

var (
	validTypes   = map[string]bool{"image": true, "icon": true, "vector": true}
	validFormats = map[string]bool{
		"svg": true, "webp": true, "png": true, "jpg": true, "jpeg": true,
		"pdf": true, "eps": true, "ai": true,
	}
)

// Build walks assetsDir and indexes vectors/, images/, icons/ (ignores shiny/, data jsons, etc).
func Build(assetsDir string) (*Index, error) {
	idx := &Index{
		AssetsDir:   assetsDir,
		ByCode:      make(map[string]*CountryAssets),
		CountByKind: make(map[string]int),
	}
	get := func(code string) *CountryAssets {
		if ca, ok := idx.ByCode[code]; ok {
			return ca
		}
		ca := &CountryAssets{
			Images:  make(map[string][]Variant),
			Icons:   make(map[string][]Variant),
			Vectors: make(map[string]string),
		}
		idx.ByCode[code] = ca
		return ca
	}
	walk := func(sub string, fn func(rel, fname, dir string, fi fs.FileInfo) error) error {
		root := filepath.Join(assetsDir, sub)
		if _, err := os.Stat(root); err != nil {
			return nil // missing dir is ok
		}
		return filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			rel, err := filepath.Rel(assetsDir, p)
			if err != nil {
				return nil
			}
			rel = filepath.ToSlash(rel)
			fi, err := d.Info()
			if err != nil {
				return nil
			}
			return fn(rel, d.Name(), filepath.ToSlash(filepath.Dir(rel)), fi)
		})
	}

	// vectors/<fmt>/<code>.<ext>
	if err := walk("vectors", func(rel, fname, dir string, fi fs.FileInfo) error {
		// dir = vectors/svg
		parts := strings.Split(dir, "/")
		if len(parts) != 2 {
			return nil
		}
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fname), "."))
		if ext == "" {
			return nil
		}
		stem := strings.ToLower(strings.TrimSuffix(fname, filepath.Ext(fname)))
		ca := get(stem)
		ca.Vectors[ext] = rel
		idx.AllRelPaths = append(idx.AllRelPaths, rel)
		idx.TotalBytes += fi.Size()
		idx.CountByKind["vector"]++
		return nil
	}); err != nil {
		return nil, err
	}

	// images/<wXXX|hXXX>/<code>.<ext>
	if err := walk("images", func(rel, fname, dir string, fi fs.FileInfo) error {
		parts := strings.Split(dir, "/")
		if len(parts) != 2 {
			return nil
		}
		sizeDir := parts[1] // w320 or h80
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fname), "."))
		if ext == "jpeg" {
			ext = "jpg"
		}
		stem := strings.ToLower(strings.TrimSuffix(fname, filepath.Ext(fname)))
		var v Variant
		v.Path = rel
		v.Size = fi.Size()
		if strings.HasPrefix(sizeDir, "w") {
			n, err := strconv.Atoi(strings.TrimPrefix(sizeDir, "w"))
			if err != nil {
				return nil
			}
			v.W = n
		} else if strings.HasPrefix(sizeDir, "h") {
			n, err := strconv.Atoi(strings.TrimPrefix(sizeDir, "h"))
			if err != nil {
				return nil
			}
			v.H = n
		} else {
			return nil
		}
		ca := get(stem)
		ca.Images[ext] = append(ca.Images[ext], v)
		idx.AllRelPaths = append(idx.AllRelPaths, rel)
		idx.TotalBytes += fi.Size()
		idx.CountByKind["image"]++
		return nil
	}); err != nil {
		return nil, err
	}

	// icons/<WxH>/<code>.<ext>
	if err := walk("icons", func(rel, fname, dir string, fi fs.FileInfo) error {
		parts := strings.Split(dir, "/")
		if len(parts) != 2 {
			return nil
		}
		wh := strings.Split(parts[1], "x")
		if len(wh) != 2 {
			return nil
		}
		w, err1 := strconv.Atoi(wh[0])
		h, err2 := strconv.Atoi(wh[1])
		if err1 != nil || err2 != nil {
			return nil
		}
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fname), "."))
		stem := strings.ToLower(strings.TrimSuffix(fname, filepath.Ext(fname)))
		v := Variant{W: w, H: h, Path: rel, Size: fi.Size()}
		ca := get(stem)
		ca.Icons[ext] = append(ca.Icons[ext], v)
		idx.AllRelPaths = append(idx.AllRelPaths, rel)
		idx.TotalBytes += fi.Size()
		idx.CountByKind["icon"]++
		return nil
	}); err != nil {
		return nil, err
	}

	// sort slices ascending
	for _, ca := range idx.ByCode {
		for f, vs := range ca.Images {
			sort.Slice(vs, func(i, j int) bool {
				ei := vs[i].W
				if ei == 0 {
					ei = vs[i].H
				}
				ej := vs[j].W
				if ej == 0 {
					ej = vs[j].H
				}
				if ei == ej {
					return vs[i].Path < vs[j].Path
				}
				return ei < ej
			})
			ca.Images[f] = vs
		}
		for f, vs := range ca.Icons {
			sort.Slice(vs, func(i, j int) bool {
				if vs[i].W == vs[j].W {
					return vs[i].H < vs[j].H
				}
				return vs[i].W < vs[j].W
			})
			ca.Icons[f] = vs
		}
	}
	return idx, nil
}

// ResolveOptions are validated resolver inputs.
type ResolveOptions struct {
	Type   string // image|icon|vector ("" defaults to image)
	Format string // "" = negotiate
	Size   string // "" = default; "320" or "80x60"
	Accept string // raw Accept header for negotiation
}

// ResolveResult is a successful resolution.
type ResolveResult struct {
	RelPath    string // assets-relative path
	AbsPath    string
	Format     string
	Kind       string // image|icon|vector
	Negotiated bool
	Variant    Variant // for raster (zero for vector)
	VectorPath string  // for vector
}

// ResolveError carries a client error + available options for DX.
type ResolveError struct {
	Status           int
	Code             string
	Message          string
	AvailableFormats []string
	AvailableSizes   []string
}

func (e *ResolveError) Error() string { return fmt.Sprintf("%s: %s", e.Code, e.Message) }

// Resolve maps (iso2, opts) to a file. iso2 must already be normalized lowercase.
func (idx *Index) Resolve(iso2 string, o ResolveOptions) (*ResolveResult, *ResolveError) {
	ca, ok := idx.ByCode[iso2]
	if !ok {
		return nil, &ResolveError{Status: 404, Code: "country_not_found", Message: "unknown country code: " + iso2}
	}
	kind := strings.ToLower(o.Type)
	if kind == "" {
		// vector formats imply vector kind
		f := strings.ToLower(o.Format)
		if f == "svg" || f == "pdf" || f == "eps" || f == "ai" {
			// Ambiguous: svg could be vector only (vectors exist only as svg/pdf/ai/eps).
			// If type empty and format is vector-only, serve vector.
			if _, ok := ca.Vectors[f]; ok {
				kind = "vector"
			} else {
				kind = "image"
			}
		} else {
			kind = "image"
		}
	}
	if !validTypes[kind] {
		return nil, &ResolveError{Status: 400, Code: "invalid_type", Message: "type must be one of: image, icon"}
	}
	format := strings.ToLower(o.Format)
	if format == "jpeg" {
		format = "jpg"
	}
	if format != "" && !validFormats[format] {
		return nil, &ResolveError{Status: 400, Code: "invalid_format", Message: "format must be one of: svg, webp, png, jpg, pdf, eps, ai"}
	}

	// vector path: direct map
	if kind == "vector" {
		if format == "" {
			format = "svg"
		}
		if p, ok := ca.Vectors[format]; ok {
			return &ResolveResult{RelPath: p, AbsPath: filepath.Join(idx.AssetsDir, filepath.FromSlash(p)), Format: format, Kind: "vector", VectorPath: p}, nil
		}
		return nil, &ResolveError{Status: 404, Code: "variant_not_found", Message: "no vector in format " + format + " for " + iso2,
			AvailableFormats: sortedKeys(ca.Vectors)}
	}

	// raster: pick slice
	var (
		slices    map[string][]Variant
		defSize   string
		defFormat string
	)
	if kind == "icon" {
		slices = ca.Icons
		defSize = "64"
	} else {
		slices = ca.Images
		defSize = "320"
	}
	_ = defFormat
	if format == "" {
		format, _ = negotiateFormat(o.Accept, slices)
		// negotiateFormat returns negotiated=true implicitly; mark result
		r, rerr := pickSize(iso2, kind, slices, format, firstNonEmpty(o.Size, defSize))
		if rerr != nil {
			return nil, rerr
		}
		r.Negotiated = true
		return r, nil
	}
	return pickSize(iso2, kind, slices, format, firstNonEmpty(o.Size, defSize))
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// negotiateFormat picks webp if accepted and available, else png, else jpg, else svg/vector.
func negotiateFormat(accept string, slices map[string][]Variant) (string, bool) {
	a := strings.ToLower(accept)
	has := func(f string) bool { _, ok := slices[f]; return ok }
	// explicit svg request via Accept
	if strings.Contains(a, "image/svg+xml") && has("svg") {
		return "svg", true
	}
	if strings.Contains(a, "image/webp") {
		if has("webp") {
			return "webp", true
		}
	}
	// */* or missing accept -> prefer png, then webp, then jpg
	if has("png") {
		// if client accepts webp and we have it, prefer webp even on */*
		if strings.Contains(a, "image/webp") && has("webp") {
			return "webp", true
		}
		if a == "" || strings.Contains(a, "*/*") || strings.Contains(a, "image/png") {
			return "png", true
		}
		// default fallback png
		return "png", true
	}
	if has("webp") {
		return "webp", true
	}
	if has("jpg") {
		return "jpg", true
	}
	// last resort: any available
	for _, f := range []string{"png", "webp", "jpg", "svg"} {
		if has(f) {
			return f, true
		}
	}
	for f := range slices {
		return f, true
	}
	return "png", true
}

func pickSize(iso2, kind string, slices map[string][]Variant, format, sizeStr string) (*ResolveResult, *ResolveError) {
	vs, ok := slices[format]
	if !ok || len(vs) == 0 {
		return nil, &ResolveError{Status: 404, Code: "variant_not_found",
			Message:          fmt.Sprintf("no %s in format %s for %s", kind, format, iso2),
			AvailableFormats: sortedSliceKeys(slices),
			AvailableSizes:   availableSizes(slices)}
	}
	// parse size: "320" or "80x60"
	wantW, wantH := 0, 0
	s := strings.ToLower(strings.TrimSpace(sizeStr))
	if strings.Contains(s, "x") {
		parts := strings.SplitN(s, "x", 2)
		w, err1 := strconv.Atoi(strings.TrimSpace(parts[0]))
		h, err2 := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err1 != nil || err2 != nil || w <= 0 || h <= 0 {
			return nil, &ResolveError{Status: 400, Code: "invalid_size", Message: "size must be like 320 or 80x60"}
		}
		wantW, wantH = w, h
	} else {
		n, err := strconv.Atoi(s)
		if err != nil || n <= 0 {
			return nil, &ResolveError{Status: 400, Code: "invalid_size", Message: "size must be like 320 or 80x60"}
		}
		wantW = n
	}
	// exact match first
	for _, v := range vs {
		if wantH > 0 {
			if v.W == wantW && v.H == wantH {
				return resultFor(v, format, kind), nil
			}
		} else {
			if v.W == wantW || v.H == wantW {
				return resultFor(v, format, kind), nil
			}
		}
	}
	// smallest >= requested
	best := -1
	for i, v := range vs {
		eff := v.W
		if kind == "image" && v.W == 0 {
			// h-dir entry: compare H against wantW? For h-images, requested width semantics:
			// treat requested N as height-equivalent. Use H.
			eff = v.H
		} else if wantH > 0 {
			// WxH request: compare width primarily
			eff = v.W
		}
		want := wantW
		if wantH > 0 {
			want = wantW
		}
		if eff >= want {
			best = i
			break
		}
	}
	if best >= 0 {
		return resultFor(vs[best], format, kind), nil
	}
	// else largest
	return resultFor(vs[len(vs)-1], format, kind), nil
}

func resultFor(v Variant, format, kind string) *ResolveResult {
	return &ResolveResult{RelPath: v.Path, Format: format, Kind: kind, Variant: v}
}

func sortedKeys(m map[string]string) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func sortedSliceKeys(m map[string][]Variant) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func availableSizes(m map[string][]Variant) []string {
	set := map[string]bool{}
	for _, vs := range m {
		for _, v := range vs {
			var s string
			if v.W > 0 && v.H > 0 {
				s = fmt.Sprintf("%dx%d", v.W, v.H)
			} else if v.W > 0 {
				s = fmt.Sprintf("%d", v.W)
			} else {
				s = fmt.Sprintf("%d", v.H)
			}
			set[s] = true
		}
	}
	out := make([]string, 0, len(set))
	for s := range set {
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}

// AbsPath returns filesystem path for a rel path.
func (idx *Index) AbsPath(rel string) string {
	return filepath.Join(idx.AssetsDir, filepath.FromSlash(rel))
}
