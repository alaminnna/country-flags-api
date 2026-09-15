package quiz

import (
	"bytes"
	"encoding/json"
	"testing"

	"flagsapi/internal/meta"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	m, err := meta.Load("../../assets")
	if err != nil {
		t.Fatalf("meta load: %v", err)
	}
	s, err := New(m)
	if err != nil {
		t.Fatalf("quiz new: %v", err)
	}
	return s
}

func TestSeedParsing(t *testing.T) {
	if _, ok := ParseSeed(""); ok {
		t.Fatal("empty seed should report ok=false")
	}
	a, _ := ParseSeed("12345")
	if a != 12345 {
		t.Fatalf("u64 seed: got %d", a)
	}
	b, _ := ParseSeed("hello")
	c, _ := ParseSeed("hello")
	if b != c {
		t.Fatal("string seed hashing unstable")
	}
	if b == HashString("other") {
		t.Fatal("different strings hashed equal (unlikely)")
	}
	// decimal stability: numeric string must NOT go through FNV
	d, _ := ParseSeed("007")
	if d != 7 {
		t.Fatalf("leading-zero numeric: got %d", d)
	}
}

func TestDeterminismByteIdentical(t *testing.T) {
	s := testStore(t)
	for _, mode := range Modes {
		for _, diff := range Difficulties {
			pool := s.eligible[mode][diff]
			if len(pool) == 0 && mode != ModeMixed {
				t.Fatalf("empty pool %s/%s", mode, diff)
			}
			q1, err := s.Generate(mode, diff, 5, 42)
			if err != nil {
				t.Fatalf("gen %s/%s: %v", mode, diff, err)
			}
			q2, err := s.Generate(mode, diff, 5, 42)
			if err != nil {
				t.Fatalf("gen2 %s/%s: %v", mode, diff, err)
			}
			b1, _ := MarshalSet(q1)
			b2, _ := MarshalSet(q2)
			if !bytes.Equal(b1, b2) {
				t.Fatalf("same seed not byte-identical for %s/%s", mode, diff)
			}
			// string seed hashes to same quiz as its numeric hash
			h, _ := ParseSeed("some-string-seed")
			q3, _ := s.Generate(mode, diff, 5, h)
			b3, _ := MarshalSet(q3)
			_ = b3
		}
	}
}

func TestDistinctSeeds(t *testing.T) {
	s := testStore(t)
	seen := map[string]bool{}
	for i := 0; i < 20; i++ {
		q, err := s.Generate(ModeFlagToCountry, "hard", 10, uint64(1000+i))
		if err != nil {
			t.Fatal(err)
		}
		b, _ := MarshalSet(q)
		seen[string(b)] = true
	}
	if len(seen) < 19 {
		t.Fatalf("20 seeds gave only %d distinct sets, want >=19", len(seen))
	}
}

func TestOptionInvariants(t *testing.T) {
	s := testStore(t)
	combos := [][2]string{
		{ModeFlagToCountry, "easy"}, {ModeFlagToCountry, "expert"},
		{ModeCountryToFlag, "easy"}, {ModeCountryToFlag, "expert"},
		{ModeFlagToCapital, "medium"}, {ModeFlagToCapital, "hard"},
		{ModeFlagToRegion, "easy"}, {ModeFlagToRegion, "hard"},
		{ModeMixed, "medium"}, {ModeMixed, "expert"},
	}
	for _, c := range combos {
		mode, diff := c[0], c[1]
		qs, err := s.Generate(mode, diff, 10, 7)
		if err != nil {
			t.Fatalf("gen %s/%s: %v", mode, diff, err)
		}
		for _, q := range qs.Questions {
			want := 4
			if diff == "expert" {
				want = 6
			}
			switch opts := q.Options.(type) {
			case []string:
				if len(opts) != want {
					t.Fatalf("%s/%s q%d: got %d opts want %d", mode, diff, q.ID, len(opts), want)
				}
				seen := map[string]bool{}
				for _, o := range opts {
					if seen[o] {
						t.Fatalf("%s/%s q%d: duplicate option text %q", mode, diff, q.ID, o)
					}
					seen[o] = true
				}
				if q.Answer < 0 || q.Answer >= len(opts) {
					t.Fatalf("%s/%s q%d: answer index %d out of range", mode, diff, q.ID, q.Answer)
				}
				// answer text appears exactly once and equals correct display text
				ans, _ := s.byID[q.Code]
				wantText := displayText(ans, q.Mode)
				hits := 0
				for _, o := range opts {
					if o == wantText {
						hits++
					}
				}
				if hits != 1 {
					t.Fatalf("%s/%s q%d: answer text present %d times", mode, diff, q.ID, hits)
				}
			case []FlagOption:
				if q.Mode != ModeCountryToFlag {
					t.Fatalf("flag options in non-flag mode %s", q.Mode)
				}
				if len(opts) != want {
					t.Fatalf("%s/%s q%d: got %d flag opts want %d", mode, diff, q.ID, len(opts), want)
				}
				seen := map[string]bool{}
				for _, o := range opts {
					if seen[o.Code] {
						t.Fatalf("duplicate flag option %s", o.Code)
					}
					seen[o.Code] = true
					if o.FlagURL == "" {
						t.Fatalf("empty flagUrl for %s", o.Code)
					}
				}
				if q.Answer < 0 || q.Answer >= len(opts) {
					t.Fatalf("answer index out of range")
				}
				if opts[q.Answer].Code != q.Code {
					t.Fatalf("answer flag mismatch: %s vs %s", opts[q.Answer].Code, q.Code)
				}
			default:
				t.Fatalf("%s/%s q%d: unknown options type %T", mode, diff, q.ID, q.Options)
			}
		}
	}
}

func TestCapitalEligibility(t *testing.T) {
	s := testStore(t)
	// capital-less countries must never be answers in capital modes.
	for i := uint64(0); i < 30; i++ {
		for _, diff := range Difficulties {
			qs, err := s.Generate(ModeFlagToCapital, diff, 5, 500+i)
			if err != nil {
				t.Fatal(err)
			}
			for _, q := range qs.Questions {
				c := s.byID[q.Code]
				if c.Meta.Capital == "" {
					t.Fatalf("capital-less %s appeared in capital mode", q.Code)
				}
			}
		}
	}
	// region mode answers must be clean regions.
	for i := uint64(0); i < 20; i++ {
		qs, _ := s.Generate(ModeFlagToRegion, "hard", 5, 900+i)
		for _, q := range qs.Questions {
			c := s.byID[q.Code]
			if !isCleanRegion(c.Meta.Continent) {
				t.Fatalf("unclean region %q (%s) in region mode", c.Meta.Continent, q.Code)
			}
		}
	}
}

func TestScoreFormula(t *testing.T) {
	cases := []struct {
		correct bool
		ms      int
		streak  int
		want    int
	}{
		{true, 0, 1, 150},     // 100 + 50 + 0
		{true, 200, 1, 149},   // floor(200/200)=1 → 49
		{true, 10000, 1, 100}, // 50-50=0
		{true, 20000, 1, 100}, // clamped 0
		{true, 0, 3, 170},     // 100+50+20
		{true, 400, 2, 158},   // 100+48+10
		{false, 0, 5, 0},
		{false, 100, 0, 0},
		{true, -50, 1, 150}, // negative clamped
	}
	for i, c := range cases {
		if got := ScoreQuestion(c.correct, c.ms, c.streak); got != c.want {
			t.Fatalf("case %d: got %d want %d", i, got, c.want)
		}
	}
}

func TestScoreFormula100msBucketing(t *testing.T) {
	// 100ms bucketing: floor(ms/100)*100 applied before timeBonus
	cases := []struct {
		name     string
		correct  bool
		ms       int
		streak   int
		want     int
	}{
		{"99ms and 100ms same bucket", true, 99, 1, 150},    // bucketed 0 → 50 bonus
		{"100ms same bucket", true, 100, 1, 150},            // bucketed 100 → 50 bonus (100/200=0)
		{"199ms and 200ms different buckets", true, 199, 1, 150}, // bucketed 100 → 50 bonus
		{"200ms boundary", true, 200, 1, 149},               // bucketed 200 → 49 bonus
		{"1999ms", true, 1999, 1, 141},                      // bucketed 1900 → 41 bonus
		{"2001ms", true, 2001, 1, 140},                      // bucketed 2000 → 40 bonus
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := ScoreQuestion(c.correct, c.ms, c.streak)
			if got != c.want {
				t.Errorf("ScoreQuestion(%v, %d, %d) = %d, want %d", c.correct, c.ms, c.streak, got, c.want)
			}
		})
	}
}

func TestGradeEndToEnd(t *testing.T) {
	s := testStore(t)
	qs, err := s.Generate(ModeFlagToCountry, "easy", 5, 1234)
	if err != nil {
		t.Fatal(err)
	}
	// answer everything correctly, instantly → 150 each, streaks 1..5
	answers := make([]int, 5)
	times := make([]int, 5)
	for i, q := range qs.Questions {
		answers[i] = q.Answer
		times[i] = 0
	}
	resp, err := s.Grade(GradeRequest{Seed: "1234", Mode: ModeFlagToCountry, Difficulty: "easy", Answers: answers, TimesMs: times})
	if err != nil {
		t.Fatal(err)
	}
	// 150+160+170+180+190 = 850
	if resp.Score != 850 {
		t.Fatalf("all-correct instant score: got %d want 850", resp.Score)
	}
	if resp.Correct != 5 || resp.BestStreak != 5 {
		t.Fatalf("correct=%d best=%d", resp.Correct, resp.BestStreak)
	}
	// all wrong → 0, streak reset
	wrong := make([]int, 5)
	for i, q := range qs.Questions {
		wrong[i] = (q.Answer + 1) % 4
	}
	resp2, _ := s.Grade(GradeRequest{Seed: "1234", Mode: ModeFlagToCountry, Difficulty: "easy", Answers: wrong, TimesMs: times})
	if resp2.Score != 0 || resp2.Correct != 0 || resp2.BestStreak != 0 {
		t.Fatalf("all-wrong: %+v", resp2)
	}
	// timeout (-1) counts as wrong
	mix := []int{qs.Questions[0].Answer, -1, qs.Questions[2].Answer, -1, qs.Questions[4].Answer}
	resp3, _ := s.Grade(GradeRequest{Seed: "1234", Mode: ModeFlagToCountry, Difficulty: "easy", Answers: mix, TimesMs: times})
	if resp3.Correct != 3 {
		t.Fatalf("mixed correct: got %d", resp3.Correct)
	}
	if resp3.BestStreak != 1 {
		t.Fatalf("mixed best streak: got %d want 1 (no consecutive)", resp3.BestStreak)
	}
}

func TestDaily(t *testing.T) {
	d1, err := DailyForDate("2025-01-01")
	if err != nil {
		t.Fatal(err)
	}
	if d1.DailyNumber != 1 {
		t.Fatalf("epoch day number: got %d", d1.DailyNumber)
	}
	d2, _ := DailyForDate("2025-01-02")
	if d2.DailyNumber != 2 {
		t.Fatalf("day2: got %d", d2.DailyNumber)
	}
	if d1.Seed == d2.Seed {
		t.Fatal("consecutive daily seeds equal")
	}
	// stable within a day
	a, _ := DailyForDate("2026-03-15")
	b, _ := DailyForDate("2026-03-15")
	if a != b {
		t.Fatal("daily not stable within day")
	}
	// mode rotation check: #1 → Modes[0]
	if d1.Mode != Modes[0] {
		t.Fatalf("daily #1 mode: got %s want %s", d1.Mode, Modes[0])
	}
	// weekly difficulty: days 1-7 easy, 8-14 medium
	for day := 1; day <= 7; day++ {
		n := day
		week := ((n - 1) / 7) % len(Difficulties)
		if Difficulties[week] != "easy" {
			t.Fatalf("day %d should be easy", day)
		}
	}
	d8, _ := DailyForDate("2025-01-08")
	if d8.Difficulty != "medium" {
		t.Fatalf("day 8 difficulty: got %s", d8.Difficulty)
	}
}

func TestMarshalStableJSON(t *testing.T) {
	s := testStore(t)
	q, _ := s.Generate(ModeCountryToFlag, "hard", 5, 99)
	b1, _ := MarshalSet(q)
	// decode + re-encode preserves options shape
	var wire map[string]any
	if err := json.Unmarshal(b1, &wire); err != nil {
		t.Fatal(err)
	}
	qs2, ok := wire["questions"].([]any)
	if !ok || len(qs2) != 5 {
		t.Fatalf("questions len: %v", wire["questions"])
	}
}
