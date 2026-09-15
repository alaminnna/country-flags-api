package quiz

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// ── HTTP handlers (mounted in cmd/flagsapi; inherit global CORS/rate-limit) ─

func writeErr(w http.ResponseWriter, status int, code, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"error": map[string]any{"code": code, "message": msg}})
}

func writeJSONRaw(w http.ResponseWriter, r *http.Request, raw, gz []byte, cache string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", cache)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") && len(gz) > 0 {
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

// Meta handles GET /api/v1/quiz/meta.
func (s *Store) Meta(w http.ResponseWriter, r *http.Request) {
	raw, gz := s.MetaJSON()
	writeJSONRaw(w, r, raw, gz, "public, max-age=3600")
}

// Questions handles GET /api/v1/quiz/questions?mode=&difficulty=&count=&seed=.
func (s *Store) Questions(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	mode := strings.TrimSpace(q.Get("mode"))
	if mode == "" {
		mode = ModeMixed
	}
	diff := strings.TrimSpace(q.Get("difficulty"))
	if diff == "" {
		diff = "medium"
	}
	count := 10
	if c := strings.TrimSpace(q.Get("count")); c != "" {
		n, err := strconv.Atoi(c)
		if err != nil {
			writeErr(w, 400, "invalid_count", "count must be one of 5, 10, 15, 20")
			return
		}
		count = n
	}
	if !validMode(mode) {
		writeErr(w, 400, "invalid_mode", "mode must be one of: "+strings.Join(Modes, ", "))
		return
	}
	if !validDifficulty(diff) {
		writeErr(w, 400, "invalid_difficulty", "difficulty must be one of: "+strings.Join(Difficulties, ", "))
		return
	}
	if !validCount(count) {
		writeErr(w, 400, "invalid_count", "count must be one of 5, 10, 15, 20")
		return
	}
	seedRaw := strings.TrimSpace(q.Get("seed"))
	var seed uint64
	var seeded bool
	if seedRaw == "" {
		seed = RandomSeed()
		seeded = false
	} else {
		var ok bool
		seed, ok = ParseSeed(seedRaw)
		if !ok {
			writeErr(w, 400, "invalid_seed", "seed must be a u64 or string")
			return
		}
		seeded = true
	}
	qs, err := s.Generate(mode, diff, count, seed)
	if err != nil {
		writeErr(w, 400, "generation_failed", err.Error())
		return
	}
	raw, err := MarshalSet(qs)
	if err != nil {
		writeErr(w, 500, "internal", "marshal failed")
		return
	}
	cache := "no-store"
	if seeded {
		cache = "public, max-age=86400"
	}
	writeJSONRaw(w, r, raw, gzipBytes(raw), cache)
}

// Daily handles GET /api/v1/quiz/daily — meta daily block + full question set.
func (s *Store) Daily(w http.ResponseWriter, r *http.Request) {
	d := DailyToday()
	qs, err := s.Generate(d.Mode, d.Difficulty, d.Count, d.SeedUint)
	if err != nil {
		writeErr(w, 500, "internal", err.Error())
		return
	}
	qsRaw, _ := MarshalSet(qs)
	var qsWire any
	_ = json.Unmarshal(qsRaw, &qsWire)
	body := map[string]any{
		"date": d.Date, "dailyNumber": d.DailyNumber, "seed": d.Seed,
		"mode": d.Mode, "difficulty": d.Difficulty, "count": d.Count,
		"quiz": qsWire,
	}
	raw, _ := json.Marshal(body)
	writeJSONRaw(w, r, raw, gzipBytes(raw), "public, max-age=300")
}

// Grade handles POST /api/v1/quiz/grade {seed, mode, difficulty, answers, timesMs}.
func (s *Store) GradeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeErr(w, 405, "method_not_allowed", "use POST")
		return
	}
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil || len(body) == 0 {
		writeErr(w, 400, "invalid_body", "empty body")
		return
	}
	var req GradeRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeErr(w, 400, "invalid_body", "invalid JSON")
		return
	}
	resp, err := s.Grade(req)
	if err != nil {
		writeErr(w, 400, "invalid_request", err.Error())
		return
	}
	raw, _ := json.Marshal(resp)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}
