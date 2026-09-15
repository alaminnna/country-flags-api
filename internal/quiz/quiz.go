// Package quiz implements a stateless, seeded quiz generator.
//
// Philosophy: same seed + mode + difficulty + count → byte-identical quiz,
// forever. Grading regenerates the quiz from the seed and compares answers.
// No database, no sessions, stdlib only. Read-only after boot.
package quiz

import (
	"bytes"
	"compress/gzip"
	"crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	mrand "math/rand"
	"sort"
	"strconv"
	"strings"
	"time"

	"flagsapi/internal/meta"
)

// ── Modes / difficulties / counts ──────────────────────────────────────

const (
	ModeFlagToCountry = "flag-to-country"
	ModeCountryToFlag = "country-to-flag"
	ModeFlagToCapital = "flag-to-capital"
	ModeFlagToRegion  = "flag-to-region"
	ModeMixed         = "mixed"
)

var Modes = []string{
	ModeFlagToCountry,
	ModeCountryToFlag,
	ModeFlagToCapital,
	ModeFlagToRegion,
	ModeMixed,
}

// BaseModes are the concrete modes Mixed draws from (Mixed excluded to avoid recursion).
var BaseModes = []string{
	ModeFlagToCountry,
	ModeCountryToFlag,
	ModeFlagToCapital,
	ModeFlagToRegion,
}

var Difficulties = []string{"easy", "medium", "hard", "expert"}

var ValidCounts = []int{5, 10, 15, 20}

// DailyCount is fixed so the daily challenge is comparable worldwide.
const DailyCount = 10

// CleanRegions are the only valid answers for flag-to-region.
// Countries with empty or combined continents (e.g. "Asia, Europe") are
// ineligible for region questions — the answer would be ambiguous.
var CleanRegions = []string{"Africa", "Asia", "Europe", "North America", "South America", "Oceania"}

func isCleanRegion(s string) bool {
	for _, r := range CleanRegions {
		if s == r {
			return true
		}
	}
	return false
}

// ── Curated pools ──────────────────────────────────────────────────────

// EasyList is the curated ~60 recognizable countries (uppercase ISO2 in spec).
var EasyList = []string{
	"US", "CA", "MX", "BR", "AR", "GB", "FR", "DE", "IT", "ES", "PT", "NL",
	"BE", "CH", "AT", "SE", "NO", "DK", "FI", "IS", "IE", "PL", "UA", "RU",
	"CN", "JP", "KR", "IN", "PK", "BD", "LK", "NP", "TH", "VN", "ID", "MY",
	"SG", "PH", "AU", "NZ", "EG", "ZA", "NG", "KE", "MA", "DZ", "GH", "ET",
	"SA", "AE", "QA", "TR", "IR", "IQ", "IL", "GR", "HU", "CZ", "RO", "BG",
	"RS", "HR",
}

// looklikeSpec is the curated confusability spec. "?" entries are dropped.
const looklikeSpec = `
id mc
td ro
ml sn
ne ng
ru si sk
ie ci
au nz
at de
is no
nl lu
sy eg ye iq
co ec ve
hn ni sv
bo gh gn bj
us my lr
mx it hu bg ir
tn tr
`

// ── Seed handling ─────────────────────────────────────────────────────

// HashString is FNV-1a 64 of s. Stable forever; used for string seeds and daily seeds.
func HashString(s string) uint64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(s))
	return h.Sum64()
}

// ParseSeed accepts a u64 decimal or any string (hashed with FNV-1a 64).
// Empty string reports ok=false so the caller can mint a random seed.
func ParseSeed(s string) (uint64, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	if n, err := strconv.ParseUint(s, 10, 64); err == nil {
		return n, true
	}
	return HashString(s), true
}

// RandomSeed mints a cryptographically random u64 (used when ?seed= omitted).
func RandomSeed() uint64 {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return uint64(time.Now().UnixNano())
	}
	return binary.LittleEndian.Uint64(b[:])
}

// SeedString renders a seed as decimal (canonical form for share URLs).
func SeedString(seed uint64) string {
	return strconv.FormatUint(seed, 10)
}

// ── Daily ─────────────────────────────────────────────────────────────

var dailyEpoch = time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)

// DailyInfo describes one daily challenge.
type DailyInfo struct {
	Date        string `json:"date"`
	DailyNumber int    `json:"dailyNumber"`
	Seed        string `json:"seed"`
	Mode        string `json:"mode"`
	Difficulty  string `json:"difficulty"`
	Count       int    `json:"count"`
	SeedUint    uint64 `json:"-"`
}

// DailyForDate derives the daily challenge for a UTC "YYYY-MM-DD" date.
// Mode rotates daily through Modes (mixed included). Difficulty stays fixed
// for a 7-day week then advances easy→medium→hard→expert.
func DailyForDate(dateStr string) (DailyInfo, error) {
	t, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		return DailyInfo{}, fmt.Errorf("invalid date, want YYYY-MM-DD")
	}
	t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	if t.Before(dailyEpoch) {
		return DailyInfo{}, fmt.Errorf("date before daily epoch 2025-01-01")
	}
	n := int(t.Sub(dailyEpoch).Hours()/24) + 1
	seed := HashString("daily-" + t.Format("2006-01-02"))
	mode := Modes[(n-1)%len(Modes)]
	week := ((n - 1) / 7) % len(Difficulties)
	return DailyInfo{
		Date:        t.Format("2006-01-02"),
		DailyNumber: n,
		Seed:        SeedString(seed),
		Mode:        mode,
		Difficulty:  Difficulties[week],
		Count:       DailyCount,
		SeedUint:    seed,
	}, nil
}

// DailyToday uses the current UTC date.
func DailyToday() DailyInfo {
	d, _ := DailyForDate(time.Now().UTC().Format("2006-01-02"))
	return d
}

// ── Quiz types ────────────────────────────────────────────────────────

// FlagOption is one image-only option for country-to-flag (NO name — labels would spoil it).
type FlagOption struct {
	Code    string `json:"code"`
	FlagURL string `json:"flagUrl"`
}

// Question is one quiz question. Options is []string for text modes or
// []FlagOption for country-to-flag.
type Question struct {
	ID      int    `json:"id"`
	Code    string `json:"code"` // correct country's ISO2 (lowercase)
	Mode    string `json:"mode"` // concrete mode (mixed questions carry their sub-mode)
	FlagURL string `json:"flagUrl,omitempty"`
	Prompt  string `json:"prompt"`
	Options any    `json:"options"`
	Answer  int    `json:"answer"`
}

// questionJSON is the stable wire shape (Options as raw JSON for byte determinism).
type questionJSON struct {
	ID      int             `json:"id"`
	Code    string          `json:"code"`
	Mode    string          `json:"mode"`
	FlagURL string          `json:"flagUrl,omitempty"`
	Prompt  string          `json:"prompt"`
	Options json.RawMessage `json:"options"`
	Answer  int             `json:"answer"`
}

// QuizSet is a generated quiz.
type QuizSet struct {
	Seed       string     `json:"seed"`
	Mode       string     `json:"mode"`
	Difficulty string     `json:"difficulty"`
	Count      int        `json:"count"`
	Questions  []Question `json:"questions"`
}

// quizSetJSON mirrors QuizSet with stable question encoding.
type quizSetJSON struct {
	Seed       string         `json:"seed"`
	Mode       string         `json:"mode"`
	Difficulty string         `json:"difficulty"`
	Count      int            `json:"count"`
	Questions  []questionJSON `json:"questions"`
}

// ModeInfo / DifficultyInfo for /meta.
type ModeInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type DifficultyInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// MetaResponse is the precomputed /quiz/meta payload.
type MetaResponse struct {
	Modes        []ModeInfo       `json:"modes"`
	Difficulties []DifficultyInfo `json:"difficulties"`
	Counts       []int            `json:"counts"`
	Daily        DailyInfo        `json:"daily"`
}

// GradeRequest is POST /quiz/grade body. -1 = unanswered/timeout.
type GradeRequest struct {
	Seed       string `json:"seed"`
	Mode       string `json:"mode"`
	Difficulty string `json:"difficulty"`
	Answers    []int  `json:"answers"`
	TimesMs    []int  `json:"timesMs"`
}

// GradeResultRow is one per-question verdict.
type GradeResultRow struct {
	ID          int    `json:"id"`
	Code        string `json:"code"`
	Answer      int    `json:"answer"`
	Chosen      int    `json:"chosen"`
	Correct     bool   `json:"correct"`
	CorrectText string `json:"correctText"`
	FlagURL     string `json:"flagUrl"`
}

// GradeResponse is the stateless grade result.
type GradeResponse struct {
	Score      int              `json:"score"`
	Correct    int              `json:"correct"`
	Total      int              `json:"total"`
	BestStreak int              `json:"bestStreak"`
	Results    []GradeResultRow `json:"results"`
}

// ── Scoring (MUST match the frontend exactly; also documented in /docs) ──

// ScoreQuestion computes points for one question:
// correct → 100 + timeBonus + streakBonus, wrong/timeout → 0.
// Canonical elapsed time = floor(elapsedMs/100)*100 (100ms bucketing) for lossless duel packing.
// timeBonus = max(0, 50 − floor(elapsedMs/200)); streakBonus = 10×(streak−1)
// where streak includes the current correct answer.
func ScoreQuestion(correct bool, elapsedMs int, streak int) int {
	if !correct {
		return 0
	}
	if elapsedMs < 0 {
		elapsedMs = 0
	}
	elapsedMs = (elapsedMs / 100) * 100 // 100ms bucketing for lossless packing
	timeBonus := 50 - elapsedMs/200
	if timeBonus < 0 {
		timeBonus = 0
	}
	streakBonus := 0
	if streak > 1 {
		streakBonus = 10 * (streak - 1)
	}
	return 100 + timeBonus + streakBonus
}

// ── Store (boot-time pools, read-only after) ───────────────────────────

type Store struct {
	meta *meta.Store
	byID map[string]*meta.Country // iso2 lower -> country

	easySet map[string]bool
	easy    []*meta.Country // sorted by code
	medium  []*meta.Country // sorted by code (~120)
	all     []*meta.Country // sorted by code

	// eligible[mode][difficulty] — prefiltered answer pools.
	eligible map[string]map[string][]*meta.Country

	// confusable[iso2] -> sorted list of lookalike iso2 (validated via normalizer).
	confusable map[string][]string
	// byContinent[continent] -> sorted list of iso2.
	byContinent map[string][]string

	metaRaw []byte
	metaGZ  []byte
}

func modeInfos() []ModeInfo {
	return []ModeInfo{
		{ID: ModeFlagToCountry, Name: "Flag → Country", Description: "See a flag, pick the country name."},
		{ID: ModeCountryToFlag, Name: "Country → Flag", Description: "See a country name, pick its flag."},
		{ID: ModeFlagToCapital, Name: "Flag → Capital", Description: "See a flag, pick the capital city."},
		{ID: ModeFlagToRegion, Name: "Flag → Region", Description: "See a flag, pick the continent."},
		{ID: ModeMixed, Name: "Mixed", Description: "A shuffled mix of all four modes."},
	}
}

func difficultyInfos() []DifficultyInfo {
	return []DifficultyInfo{
		{ID: "easy", Name: "Easy", Description: "Famous flags, random options."},
		{ID: "medium", Name: "Medium", Description: "More countries, sometimes tricky options."},
		{ID: "hard", Name: "Hard", Description: "Every country, often confusing lookalikes."},
		{ID: "expert", Name: "Expert", Description: "Every country, 6 options, mostly lookalikes."},
	}
}

func validMode(m string) bool {
	for _, v := range Modes {
		if m == v {
			return true
		}
	}
	return false
}

func validDifficulty(d string) bool {
	for _, v := range Difficulties {
		if d == v {
			return true
		}
	}
	return false
}

func validCount(n int) bool {
	for _, v := range ValidCounts {
		if n == v {
			return true
		}
	}
	return false
}

// parsePopulation extracts the leading integer from strings like "168 163 758 (2020)".
func parsePopulation(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	// take leading run of digits/spaces/commas
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else if r == ' ' || r == ',' || r == '.' {
			continue
		} else {
			break
		}
	}
	n, _ := strconv.Atoi(b.String())
	return n
}

func sortedByCode(in []*meta.Country) []*meta.Country {
	out := append([]*meta.Country(nil), in...)
	sort.Slice(out, func(i, j int) bool { return out[i].Code < out[j].Code })
	return out
}

// New builds difficulty pools + confusability index from the meta store.
func New(m *meta.Store) (*Store, error) {
	if m == nil || len(m.All) == 0 {
		return nil, fmt.Errorf("quiz: empty meta store")
	}
	s := &Store{
		meta:        m,
		byID:        map[string]*meta.Country{},
		easySet:     map[string]bool{},
		eligible:    map[string]map[string][]*meta.Country{},
		confusable:  map[string][]string{},
		byContinent: map[string][]string{},
	}
	for _, c := range m.All {
		iso := strings.ToLower(strings.TrimSpace(c.Code))
		s.byID[iso] = c
	}
	// easy pool: curated list resolved through the normalizer; unknown dropped.
	var easy []*meta.Country
	seen := map[string]bool{}
	for _, raw := range EasyList {
		key := strings.ToLower(strings.TrimSpace(raw))
		c, ok := m.LookupCode(key)
		if !ok {
			continue
		}
		iso := strings.ToLower(c.Code)
		if seen[iso] {
			continue
		}
		seen[iso] = true
		s.easySet[iso] = true
		easy = append(easy, c)
	}
	s.easy = sortedByCode(easy)

	// medium: easy + largest-by-population up to ~120.
	type popRow struct {
		c *meta.Country
		n int
	}
	var rows []popRow
	for _, c := range m.All {
		iso := strings.ToLower(c.Code)
		if seen[iso] {
			continue
		}
		rows = append(rows, popRow{c: c, n: parsePopulation(c.Meta.Population)})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].n != rows[j].n {
			return rows[i].n > rows[j].n
		}
		return rows[i].c.Code < rows[j].c.Code
	})
	medium := append([]*meta.Country(nil), easy...)
	for _, r := range rows {
		if len(medium) >= 120 {
			break
		}
		medium = append(medium, r.c)
	}
	s.medium = sortedByCode(medium)
	s.all = sortedByCode(m.All)

	// byContinent index (clean regions only matter for distractors, but index all).
	for _, c := range s.all {
		iso := strings.ToLower(c.Code)
		cont := strings.TrimSpace(c.Meta.Continent)
		if cont == "" {
			continue
		}
		s.byContinent[cont] = append(s.byContinent[cont], iso)
	}
	for k := range s.byContinent {
		sort.Strings(s.byContinent[k])
	}

	// confusability from spec, validated through the normalizer.
	adj := map[string]map[string]bool{}
	addEdge := func(a, b string) {
		if a == b || a == "" || b == "" {
			return
		}
		if adj[a] == nil {
			adj[a] = map[string]bool{}
		}
		if adj[b] == nil {
			adj[b] = map[string]bool{}
		}
		adj[a][b] = true
		adj[b][a] = true
	}
	for _, line := range strings.Split(looklikeSpec, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		var group []string
		for _, tok := range strings.Fields(line) {
			tok = strings.ToLower(strings.TrimSpace(tok))
			if tok == "" || tok == "?" || tok == "sl?" {
				continue
			}
			tok = strings.TrimSuffix(tok, "?")
			c, ok := m.LookupCode(tok)
			if !ok {
				continue // unknown codes dropped silently
			}
			group = append(group, strings.ToLower(c.Code))
		}
		for i := 0; i < len(group); i++ {
			for j := i + 1; j < len(group); j++ {
				addEdge(group[i], group[j])
			}
		}
	}
	for k, set := range adj {
		var list []string
		for v := range set {
			list = append(list, v)
		}
		sort.Strings(list)
		s.confusable[k] = list
	}

	// eligible pools per (mode, difficulty).
	diffPool := map[string][]*meta.Country{
		"easy":   s.easy,
		"medium": s.medium,
		"hard":   s.all,
		"expert": s.all,
	}
	for _, mode := range Modes {
		s.eligible[mode] = map[string][]*meta.Country{}
		for _, diff := range Difficulties {
			pool := diffPool[diff]
			var out []*meta.Country
			for _, c := range pool {
				switch mode {
				case ModeFlagToCapital, ModeMixed:
					// Mixed eligibility checked per-question; keep capital-less out of
					// the mixed pool only when the sub-mode needs it (handled at gen).
					// For the top-level mixed pool keep the full pool.
					if mode == ModeFlagToCapital && strings.TrimSpace(c.Meta.Capital) == "" {
						continue
					}
				case ModeFlagToRegion:
					if !isCleanRegion(strings.TrimSpace(c.Meta.Continent)) {
						continue
					}
				}
				out = append(out, c)
			}
			s.eligible[mode][diff] = out
		}
	}

	// Precompute /meta payload skeleton (daily block refreshed per request;
	// the static part is cached — see MetaJSON).
	static := MetaResponse{
		Modes:        modeInfos(),
		Difficulties: difficultyInfos(),
		Counts:       append([]int(nil), ValidCounts...),
	}
	raw, _ := json.Marshal(static)
	_ = raw
	// metaRaw/GZ are built per-request for the daily block (cheap: <1KB).
	// Keep a gzip helper ready.
	s.metaRaw = nil
	s.metaGZ = nil
	return s, nil
}

// MetaJSON returns the /quiz/meta body (daily block = today UTC). Precomputed shape, tiny.
func (s *Store) MetaJSON() ([]byte, []byte) {
	m := MetaResponse{
		Modes:        modeInfos(),
		Difficulties: difficultyInfos(),
		Counts:       append([]int(nil), ValidCounts...),
		Daily:        DailyToday(),
	}
	raw, _ := json.Marshal(m)
	return raw, gzipBytes(raw)
}

func gzipBytes(src []byte) []byte {
	var buf bytes.Buffer
	w, _ := gzip.NewWriterLevel(&buf, 5)
	_, _ = w.Write(src)
	_ = w.Close()
	return buf.Bytes()
}

// ── Generation (pure, seeded) ──────────────────────────────────────────

func flagURL(code string, size string) string {
	return "/assets/v1/images/" + size + "/" + strings.ToLower(code) + ".png"
}

func optionsCount(difficulty string) int {
	if difficulty == "expert" {
		return 6
	}
	return 4
}

// confusableFirstQuota: how many distractors should come from the
// confusable/related set before filling randomly.
func confusableQuota(difficulty string) int {
	switch difficulty {
	case "easy":
		return 0
	case "medium":
		return 1 // ~25% of 3 distractors
	case "hard":
		return 2 // ~50%+ of 3 distractors
	case "expert":
		return 3 // ≥3 of 5 distractors
	}
	return 0
}

// eligibleFor answers the question: can c be the ANSWER for mode?
func eligibleFor(c *meta.Country, mode string) bool {
	switch mode {
	case ModeFlagToCapital:
		return strings.TrimSpace(c.Meta.Capital) != ""
	case ModeFlagToRegion:
		return isCleanRegion(strings.TrimSpace(c.Meta.Continent))
	default:
		return true
	}
}

// displayText is the text answer for text modes.
func displayText(c *meta.Country, mode string) string {
	switch mode {
	case ModeFlagToCapital:
		return strings.TrimSpace(c.Meta.Capital)
	case ModeFlagToRegion:
		return strings.TrimSpace(c.Meta.Continent)
	default:
		return c.Name
	}
}

func promptFor(c *meta.Country, mode string) string {
	switch mode {
	case ModeCountryToFlag:
		return "Which flag belongs to " + c.Name + "?"
	case ModeFlagToCapital:
		return "What is the capital of this country?"
	case ModeFlagToRegion:
		return "Which region does this flag belong to?"
	default:
		return "Which country does this flag belong to?"
	}
}

// Generate builds a deterministic quiz. mode/difficulty/count are validated.
func (s *Store) Generate(mode, difficulty string, count int, seed uint64) (*QuizSet, error) {
	if !validMode(mode) {
		return nil, fmt.Errorf("invalid mode %q", mode)
	}
	if !validDifficulty(difficulty) {
		return nil, fmt.Errorf("invalid difficulty %q", difficulty)
	}
	if !validCount(count) {
		return nil, fmt.Errorf("invalid count %d", count)
	}
	rng := mrand.New(mrand.NewSource(int64(seed)))

	// Answer pool: for mixed, use the difficulty pool filtered to countries
	// usable by at least one concrete mode; per-question sub-mode re-filters.
	pool := s.eligible[mode][difficulty]
	if mode == ModeMixed {
		// mixed answers can be any country in the difficulty pool that is
		// eligible for at least one base mode.
		var mp []*meta.Country
		var basePool []*meta.Country
		switch difficulty {
		case "easy":
			basePool = s.easy
		case "medium":
			basePool = s.medium
		default:
			basePool = s.all
		}
		for _, c := range basePool {
			if eligibleFor(c, ModeFlagToCountry) {
				mp = append(mp, c)
			}
		}
		pool = mp
	}
	if len(pool) < count {
		return nil, fmt.Errorf("pool too small (%d < %d)", len(pool), count)
	}

	// Seeded Fisher–Yates over the pool, take first `count` as answers.
	perm := rng.Perm(len(pool))
	qs := &QuizSet{
		Seed:       SeedString(seed),
		Mode:       mode,
		Difficulty: difficulty,
		Count:      count,
		Questions:  make([]Question, 0, count),
	}
	for i := 0; i < count; i++ {
		ans := pool[perm[i]]
		sub := mode
		if mode == ModeMixed {
			// pick a sub-mode this answer is eligible for (seeded).
			var cands []string
			for _, b := range BaseModes {
				if eligibleFor(ans, b) {
					cands = append(cands, b)
				}
			}
			if len(cands) == 0 {
				cands = []string{ModeFlagToCountry}
			}
			sub = cands[rng.Intn(len(cands))]
		}
		q, err := s.buildQuestion(rng, i, ans, sub, difficulty)
		if err != nil {
			return nil, err
		}
		qs.Questions = append(qs.Questions, *q)
	}
	return qs, nil
}

func (s *Store) poolFor(mode, difficulty string) []*meta.Country {
	if p, ok := s.eligible[mode][difficulty]; ok {
		return p
	}
	return s.all
}

func (s *Store) buildQuestion(rng *mrand.Rand, id int, ans *meta.Country, mode, difficulty string) (*Question, error) {
	nOpts := optionsCount(difficulty)
	quota := confusableQuota(difficulty)
	ansISO := strings.ToLower(ans.Code)

	q := &Question{ID: id, Code: ansISO, Mode: mode, Answer: 0}
	if mode != ModeCountryToFlag {
		q.FlagURL = flagURL(ansISO, "w320")
	}
	q.Prompt = promptFor(ans, mode)

	if mode == ModeCountryToFlag {
		// Image-only options: [{code, flagUrl}], no names.
		pool := s.poolFor(ModeCountryToFlag, difficulty)
		conf := s.relatedCodes(ansISO, difficulty)
		picks := pickDistractors(rng, ansISO, pool, conf, quota, nOpts-1, nil)
		if len(picks) != nOpts-1 {
			return nil, fmt.Errorf("not enough distractors for %s", ansISO)
		}
		all := append([]string{ansISO}, picks...)
		rng.Shuffle(len(all), func(i, j int) { all[i], all[j] = all[j], all[i] })
		opts := make([]FlagOption, 0, nOpts)
		answer := 0
		for i, code := range all {
			if code == ansISO {
				answer = i
			}
			opts = append(opts, FlagOption{Code: code, FlagURL: flagURL(code, "w160")})
		}
		q.Options = opts
		q.Answer = answer
		return q, nil
	}

	// Text modes.
	pool := s.poolFor(mode, difficulty)
	conf := s.relatedCodes(ansISO, difficulty)
	// display-text dedupe: capitals/regions can collide across countries.
	usedText := map[string]bool{displayText(ans, mode): true}
	usedCode := map[string]bool{ansISO: true}
	var distractTexts []string
	// confusable-first
	shuffledConf := append([]string(nil), conf...)
	rng.Shuffle(len(shuffledConf), func(i, j int) { shuffledConf[i], shuffledConf[j] = shuffledConf[j], shuffledConf[i] })
	for _, code := range shuffledConf {
		if len(distractTexts) >= quota {
			break
		}
		c, ok := s.byID[code]
		if !ok || usedCode[code] || !eligibleFor(c, mode) {
			continue
		}
		// distractors should come from a sensible pool: require membership in
		// the difficulty pool for easy/medium to keep difficulty honest.
		if (difficulty == "easy" || difficulty == "medium") && !s.inPool(code, mode, difficulty) {
			continue
		}
		t := displayText(c, mode)
		if t == "" || usedText[t] {
			continue
		}
		usedText[t] = true
		usedCode[code] = true
		distractTexts = append(distractTexts, t)
	}
	// fill randomly from the difficulty pool.
	perm := rng.Perm(len(pool))
	for _, idx := range perm {
		if len(distractTexts) >= nOpts-1 {
			break
		}
		c := pool[idx]
		iso := strings.ToLower(c.Code)
		if usedCode[iso] {
			continue
		}
		t := displayText(c, mode)
		if t == "" || usedText[t] {
			continue
		}
		usedText[t] = true
		usedCode[iso] = true
		distractTexts = append(distractTexts, t)
	}
	if len(distractTexts) != nOpts-1 {
		return nil, fmt.Errorf("not enough distractors for %s/%s", mode, ansISO)
	}
	all := append([]string{displayText(ans, mode)}, distractTexts...)
	rng.Shuffle(len(all), func(i, j int) { all[i], all[j] = all[j], all[i] })
	answer := 0
	for i, t := range all {
		if t == displayText(ans, mode) {
			answer = i
		}
	}
	q.Options = all
	q.Answer = answer
	return q, nil
}

func (s *Store) inPool(code, mode, difficulty string) bool {
	code = strings.ToLower(code)
	for _, c := range s.poolFor(mode, difficulty) {
		if strings.ToLower(c.Code) == code {
			return true
		}
	}
	return false
}

// relatedCodes returns confusable-first candidates: curated lookalikes +
// same-continent countries (no subregion field exists in the dataset).
func (s *Store) relatedCodes(ansISO string, _ string) []string {
	ansISO = strings.ToLower(ansISO)
	seen := map[string]bool{ansISO: true}
	var out []string
	for _, code := range s.confusable[ansISO] {
		if !seen[code] {
			seen[code] = true
			out = append(out, code)
		}
	}
	if ans, ok := s.byID[ansISO]; ok {
		cont := strings.TrimSpace(ans.Meta.Continent)
		if cont != "" {
			for _, code := range s.byContinent[cont] {
				if !seen[code] {
					seen[code] = true
					out = append(out, code)
				}
			}
		}
	}
	return out
}

// pickDistractors for image modes (distinct by code).
func pickDistractors(rng *mrand.Rand, ansISO string, pool []*meta.Country, conf []string, quota, need int, _ map[string]bool) []string {
	used := map[string]bool{ansISO: true}
	var out []string
	shuffled := append([]string(nil), conf...)
	rng.Shuffle(len(shuffled), func(i, j int) { shuffled[i], shuffled[j] = shuffled[j], shuffled[i] })
	for _, code := range shuffled {
		if len(out) >= quota {
			break
		}
		if used[code] {
			continue
		}
		used[code] = true
		out = append(out, code)
	}
	perm := rng.Perm(len(pool))
	for _, idx := range perm {
		if len(out) >= need {
			break
		}
		iso := strings.ToLower(pool[idx].Code)
		if used[iso] {
			continue
		}
		used[iso] = true
		out = append(out, iso)
	}
	return out
}

// ── Marshaling (byte-stable) ───────────────────────────────────────────

// MarshalSet renders a quiz deterministically (sorted keys via structs, no maps).
func MarshalSet(qs *QuizSet) ([]byte, error) {
	wire := quizSetJSON{
		Seed: qs.Seed, Mode: qs.Mode, Difficulty: qs.Difficulty, Count: qs.Count,
	}
	for _, q := range qs.Questions {
		optRaw, err := json.Marshal(q.Options)
		if err != nil {
			return nil, err
		}
		wire.Questions = append(wire.Questions, questionJSON{
			ID: q.ID, Code: q.Code, Mode: q.Mode, FlagURL: q.FlagURL, Prompt: q.Prompt,
			Options: optRaw, Answer: q.Answer,
		})
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(wire); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}

// ── Grading (stateless: regenerate + compare) ──────────────────────────

// Grade regenerates the quiz from req.Seed and scores req.Answers/req.TimesMs.
func (s *Store) Grade(req GradeRequest) (*GradeResponse, error) {
	seed, ok := ParseSeed(req.Seed)
	if !ok {
		return nil, fmt.Errorf("invalid seed")
	}
	if !validMode(req.Mode) {
		return nil, fmt.Errorf("invalid mode %q", req.Mode)
	}
	if !validDifficulty(req.Difficulty) {
		return nil, fmt.Errorf("invalid difficulty %q", req.Difficulty)
	}
	// count inferred from answers length; must be a valid count.
	count := len(req.Answers)
	if !validCount(count) {
		return nil, fmt.Errorf("invalid answers length %d", count)
	}
	qs, err := s.Generate(req.Mode, req.Difficulty, count, seed)
	if err != nil {
		return nil, err
	}
	resp := &GradeResponse{Total: count, Results: make([]GradeResultRow, 0, count)}
	streak, best, score, correct := 0, 0, 0, 0
	for i, q := range qs.Questions {
		chosen := -1
		if i < len(req.Answers) {
			chosen = req.Answers[i]
		}
		elapsed := math.MaxInt32
		if i < len(req.TimesMs) {
			elapsed = req.TimesMs[i]
		}
		isCorrect := chosen == q.Answer
		if isCorrect {
			streak++
			correct++
			if streak > best {
				best = streak
			}
			score += ScoreQuestion(true, elapsed, streak)
		} else {
			streak = 0
		}
		resp.Results = append(resp.Results, GradeResultRow{
			ID: q.ID, Code: q.Code, Answer: q.Answer, Chosen: chosen,
			Correct: isCorrect, CorrectText: s.correctText(q), FlagURL: s.flagForReview(q),
		})
	}
	resp.Score = score
	resp.Correct = correct
	resp.BestStreak = best
	return resp, nil
}

func (s *Store) correctText(q Question) string {
	switch opts := q.Options.(type) {
	case []string:
		if q.Answer >= 0 && q.Answer < len(opts) {
			return opts[q.Answer]
		}
	case []FlagOption:
		if q.Answer >= 0 && q.Answer < len(opts) {
			if c, ok := s.byID[opts[q.Answer].Code]; ok {
				return c.Name
			}
			return opts[q.Answer].Code
		}
	}
	// fallback for decoded shapes (grading always uses fresh structs, but be safe)
	return ""
}

func (s *Store) flagForReview(q Question) string {
	if q.FlagURL != "" {
		return q.FlagURL
	}
	return flagURL(q.Code, "w320")
}
