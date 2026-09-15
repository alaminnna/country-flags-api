# PROJECT: DUEL MODE — "Challenge a Friend" (Stateless, Link-Transported Duels)

## ROLE
You are a principal engineer + product designer extending the EXISTING flag quiz
platform (stateless seeded quiz API + quiz UI already shipped). You are adding
DUEL MODE: a friend challenges another friend to the same seeded quiz and both
see a full head-to-head comparison — with ZERO backend state, ZERO accounts,
ZERO realtime infrastructure. No placeholders. Production quality.

## THE CORE IDEA (read first — every decision follows from this)
A duel is COMPLETELY contained in its URL. The challenger plays a quiz, their
per-question answers + times are packed into a compact binary payload embedded
in a share link. The friend opens the link, plays the IDENTICAL quiz (same
seed), sees live "ghost" markers of the challenger during play, then gets a
question-by-question head-to-head replay. A counter-link lets the original
challenger see the friend's full breakdown too.
- No WebSocket. No room service. No server writes. The link IS the transport.
- Server changes are MINIMAL: one score-formula consistency amendment + tests.
  Everything else is frontend.

## NON-NEGOTIABLE CONSTRAINTS (inherited)
1. No database, no sessions, no server-side duel state. Duels are stateless.
2. Next.js STATIC EXPORT: the duel page route uses QUERY PARAMS
   (/quiz/duel?d=<payload>), wrapped in <Suspense> with useSearchParams.
   No dynamic path segments, no server routes.
3. Reuse everything: quiz generator, score formula, FlagImage, design tokens,
   motion system, Toast, SegmentedControl, share utilities, localStorage
   helpers.
4. Max ONE new dependency if genuinely needed (base64url is hand-rollable —
   prefer hand-rolled ~30 lines; DataView + btoa/urlSafe).
5. Touch targets ≥44px, AA contrast both themes, reduced-motion respected.

═══════════════════════════════════════════════════════════════════════════
PHASE 0 — AUDIT (MANDATORY, DO FIRST)
═══════════════════════════════════════════════════════════════════════════
1. Confirm the shipped quiz system: generator, /api/v1/quiz/* endpoints, score
   formula implementation locations (client live-scoring + server grade),
   /quiz results screen structure, share utilities, localStorage schema.
2. Print a one-page report: exact integration points for duel mode, the score
   formula's current time handling, existing share-link format.
3. HARD RULE: quiz questions endpoint must already accept seed+mode+difficulty
   +count. If anything differs in reality, adapt to reality and note it.

═══════════════════════════════════════════════════════════════════════════
PHASE 1 — THE DUEL PAYLOAD (client-side codec, lib/duel/codec.ts)
═══════════════════════════════════════════════════════════════════════════
Binary layout (little-endian), then base64url (no padding) as ?d= param:

  byte 0        version (0x01)
  bytes 1–8     seed as u64 LE (string seeds were already hashed to u64
                upstream; duels always carry the u64 form)
  byte 9        mode index      } FROZEN registry — fixed order matching
  byte 10       difficulty index} the shipped Go enums; adding modes =
  byte 11       count           } new version byte
  bytes 12–15   challenger score u32 LE
  byte 16       name length N (0–24), then N UTF-8 bytes (challenger name,
                optional, trimmed; 0 = anonymous "Your friend")
  then          count × 1 byte answers (0–5 = chosen option index,
                0xFF = skipped/timed out)
  then          count × 2 bytes u16 LE times — canonical 100ms buckets
                (see formula amendment below)
  last 4 bytes  FNV-1a32 checksum over ALL preceding bytes (LE)

Budget: worst case 105 bytes → ~140 base64url chars → full URL < 200 chars
(SMS/WhatsApp-safe). VERIFY this with a unit test at count=20.

Score formula consistency amendment (the ONE server change):
  Canonical elapsed time = floor(elapsedMs / 100) * 100, applied EVERYWHERE —
  server /quiz/grade, client live scoring, duel compare — BEFORE the
  timeBonus math. This makes packed 100ms buckets LOSSLESS relative to the
  formula: challenger's packed times reproduce their score exactly.
  Update the formula in Go + client, document in /docs, add/adjust tests.

Codec requirements:
  encodeDuel(input): Uint8Array → base64url string; decodeDuel(str): payload.
  Validation: version mismatch, truncated data, checksum mismatch, count
  mismatch vs byte length, name not valid UTF-8 → typed errors with
  user-friendly messages (never a blank crash).
  Honor-system note (document in code + docs): payload is client-decodable;
  duels are trust-based fun, not a competitive integrity system.

═══════════════════════════════════════════════════════════════════════════
PHASE 2 — FLOWS (all frontend; static-export safe)
═══════════════════════════════════════════════════════════════════════════
FLOW A — CREATE (from results + hub):
  1. After ANY quiz result screen: prominent CTA "⚔️ Challenge a friend".
     Also a "Create a challenge" card on /quiz hub, and a small button on the
     Daily card ("Challenge the Daily").
  2. One-step sheet/modal: optional name input (max 24 chars, mono counter),
     preview of link size, "Create duel link" → packs current game (seed,
     mode, difficulty, count, score, answers, times) → copies link + share
     text: "I scored 1240 in Flag Quiz (Expert · 10Q). Beat me ⚔️ <link>".
     navigator.share when available, clipboard fallback + Toast.
  3. Store created duel (checksum → meta) in localStorage so own links are
     recognized later.

FLOW B — ACCEPT (/quiz/duel?d=payload):
  1. PREGAME screen: VS composition — challenger card (name, mode/difficulty/
     count chips, their score in an animated ring) vs "You?" placeholder card.
     Headline: "{Name} challenges you". Subtext: "Same questions. Same clock."
     CTA: "Accept ⚔️". If payload invalid → friendly ErrorState with
     "Ask your friend to resend the link".
  2. OWN-LINK detection: if checksum exists in created-duels localStorage →
     show "This is YOUR challenge — share it!" with copy button (prevents
     accidentally dueling yourself).
  3. REVISIT: if this duel was already completed (localStorage) → jump
     straight to the stored result screen.

FLOW C — PLAY WITH GHOST (reuse /quiz/play engine, duel overlay):
  The play screen gains a duel HUD (desktop: slim bar under progress; mobile:
  same, above the timer bar):
    - Ghost marker: a small emerald diamond on the timer bar at the
      challenger's answer time for the CURRENT question (0xFF → marker at
      the timeout edge with a "timed out" glyph).
    - After the player answers: inline chip reveals "Rahim: ✓ 3.2s" or
      "Rahim: ✗ 4.8s" (never the chosen text — option indices only).
    - Live differential: a compact "You 340 · Them 280" running score chip.
  Everything ghost-related degrades gracefully: reduced-motion → static chip.

FLOW D — RESULTS / HEAD-TO-HEAD:
  - Winner announcement first: animated score RACE (two horizontal bars
    scaleX from 0 to score/max, staggered), crown icon drops onto winner,
    draw → balanced scale treatment. Confetti ONLY for the opener's win or
    beating the challenger (subtle, reduced-motion aware).
  - Tie-break rule (document + implement): higher score wins → equal score:
    lower total canonical time wins → else draw.
  - Question-by-question replay list: each row = question number, mini flag,
    your result chip (✓/✗ + time) vs their result chip, winner-tinted edge.
    Staggered entrance. Tap a row → expands to show the full question with
    both correct/incorrect options highlighted.
  - Stats strip: accuracy both sides, avg answer time both sides, best
    streak both sides.
  - CTAs: "Send them a rematch" (creates counter-duel: SAME seed/pack
    structure, now with YOUR name/score/answers/times → share) ·
    "Create new challenge" · "Back to Quiz".
  - Persist completed duel (payload checksum → full result) for revisit.

FLOW E — COUNTER-LINK COMPLETION:
  When the original challenger opens the friend's counter-duel link, the
  results screen detects "you created the original seed" (created-duels
  store) and adds a banner: "Rematch complete" — full comparison renders the
  same way. This closes the loop with zero server state.

═══════════════════════════════════════════════════════════════════════════
PHASE 3 — DESIGN & ANIMATION (reuse tokens; transform/opacity only)
═══════════════════════════════════════════════════════════════════════════
  - Duel visual identity: a subtle ⚔️ motif + slightly stronger deep-green
    glow on primary CTAs only. VS split uses the existing border tokens —
    no red-vs-blue clichés, green stays the only accent.
  - [ ] Pregame: challenger card springs in (scale 0.96→1), VS divider draws
        vertically (scaleY), accept button pulse (subtle, once)
  - [ ] Ghost marker: fades/scales in at its position on the timer bar
  - [ ] Score race bars: scaleX with the shared expo-out easing, 800ms,
        challenger bar 150ms delayed; numbers count-up alongside
  - [ ] Crown: drops + settles with spring; draw state crossfades
  - [ ] Replay rows: 40ms stagger fade-up; expand uses layout animation
  - [ ] Answer-time chips: pop in after both answered
  - [ ] prefers-reduced-motion: race bars → static with fade; crown → fade;
        no confetti
  - MOBILE IS THE PRIMARY SURFACE (duel links arrive via messaging apps):
        everything single-column, thumb-reachable CTAs, sticky bottom
        action bar on results. Desktop: centered max-w-3xl, same order.

═══════════════════════════════════════════════════════════════════════════
PHASE 4 — PERSISTENCE (versioned localStorage, corrupt-safe)
═══════════════════════════════════════════════════════════════════════════
  flags.quiz.duels.v1 → { created: {checksum → {meta, pack}}, completed:
  {checksum → {result, at}} } — guard JSON.parse, corrupt → reset silently.
  Prune completed beyond last 20 (LRU). Never block UI on storage errors
  (Safari private mode).

═══════════════════════════════════════════════════════════════════════════
PHASE 5 — INTEGRATION & DOCS
═══════════════════════════════════════════════════════════════════════════
  - /quiz hub: "Duel a friend" card with mini VS illustration + explainer line.
  - Command palette: "Challenge a friend", "Open a duel link" (paste field).
  - /docs: "Duels" section — how links work (conceptual: seed + packed
    results travel in the URL; stateless), tie-break rule, honor-system note,
    UTC/score-formula notes inherited. Do NOT document the byte layout
    publicly; keep it in code comments + tests.
  - Server: ONLY the score-formula bucketing amendment + updated Go tests
    (grade endpoint reproduces challenger scores from packed times exactly).

═══════════════════════════════════════════════════════════════════════════
PHASE 6 — TESTS
═══════════════════════════════════════════════════════════════════════════
  Codec (vitest/jest): round-trip at counts 5/10/15/20; checksum corruption →
  typed error; wrong version → typed error; URL length < 200 chars at
  count=20 with 24-char name; FNV-1a32 reference vectors.
  Consistency: for 100 random games, client-recomputed score from packed
  answers+times === server grade score === live score (the bucket amendment
  must make these EXACTLY equal).
  Flow: own-link detection, revisit shortcut, tie-break math table
  (score → time → draw), ghost marker positions incl. 0xFF timeout.
  Go: updated formula tests (boundary cases: 99ms/100ms/199ms/200ms).

═══════════════════════════════════════════════════════════════════════════
PHASE 7 — ACCEPTANCE CHECKLIST
═══════════════════════════════════════════════════════════════════════════
[ ] Full duel round-trip on two different devices/browsers via link only —
    identical questions, exact score reproduction from packed times
[ ] No server writes anywhere in the duel flow; quiz endpoints untouched
    except the documented formula amendment
[ ] Corrupt/old-version/tampered payload → friendly ErrorState, no crash
[ ] Own-link and completed-duel detection work; LRU prune works
[ ] Static export builds clean (Suspense around useSearchParams on /quiz/duel)
[ ] Link < 200 chars; renders correctly when pasted into WhatsApp/SMS (plain URL)
[ ] Ghost HUD, race bars, crown, replay all respect reduced-motion
[ ] Keyboard: full duel flow playable on desktop; ≥44px targets on mobile
[ ] AA contrast both themes; Lighthouse ≥95 perf + a11y on /quiz/duel
[ ] Tie-break: score → total canonical time → draw, table-tested

Finish with a SUMMARY: integration points found in Phase 0, codec vectors,
server diff (should be tiny), flows shipped, test results, deviations.

EXECUTE NOW: Begin with the Phase 0 audit report, then build + test the
codec BEFORE any UI.
```````````````````````````````````````````````````````````````````````````````
