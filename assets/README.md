# Assets Database

Complete offline flag database for **254 countries** — flag files in every format/size plus one JSON info file per country. No external links anywhere; everything is local.

**Stats:** 27,612 files · ~0.54 GB · 0 missing · 0 corrupt (every file magic-byte verified on download, 0 zero-byte files).

## Layout

```text
assets/
├── README.md                  # this file
├── data/                      # 254 per-country JSON files: <code>.json (af.json … zw.json)
├── vectors/                   # 1,016 files — 4 formats × 254 countries
│   ├── svg/<code>.svg
│   ├── pdf/<code>.pdf
│   ├── ai/<code>.ai
│   └── eps/<code>.eps
├── images/                    # 12,954 files — 17 sizes × 3 formats × 254 countries
│   ├── w20|w40|w80|w160|w320|w640|w1280|w2560/<code>.png|.webp|.jpg
│   └── h20|h24|h40|h48|h60|h80|h120|h160|h240/<code>.png|.webp|.jpg
├── icons/                     # 12,192 files — 24 waving-icon sizes × 2 formats × 254
│   └── 16x12|20x15|…|256x192/<code>.png|.webp
└── shiny/                     # legacy FlagsAPI demo (incomplete) — NOT part of this dataset
```

Flag binaries come from FlagCDN (the official CDN behind flagpedia.net); country info is scraped from the flagpedia.net country pages.

## Per-country JSON (`data/<code>.json`)

One file per country, e.g. `data/bd.json`. No `source`/`url` fields — only local `path`s.

```jsonc
{
  "code": "af",
  "name": "Afghanistan",
  "meta": {
    "title": "Flag of Afghanistan",
    "note": "This flag represents Afghanistan internationally …", // "Note:" box (19 countries have one)
    "description": "",                                            // flag history paragraph (197 countries have one)
    "emoji": "🇦🇫",
    "emoji_label": "Afghanistan Emoji",
    "sovereign_state": "Yes",
    "country_codes": "AF, AFG (ISO 3166-1)",
    "official_name": "Islamic Republic of Afghanistan",
    "capital": "Kabul",
    "continent": "Asia",
    "member_of": ["United Nations", "…"],
    "population": "32 225 560 (2019)",
    "area": "652 230 km2",
    "highest_point": "Noshaq (7 492 m, 24 580 ft)",
    "lowest_point": "Amu Darya (258 m, 846 ft)",
    "gdp_per_capita": "$ 521 (World Bank, 2018)",
    "currency": "Afghan afghani (؋, AFN)",
    "calling_code": "+93",
    "tld": ".af",
    "neighbors": [
      { "name": "Pakistan", "code": "pk", "flag": "assets/images/h80/pk.png" }
    ],
    "location": { "map_code": "AF" }
  },
  "flags": {
    "vector-svg": "assets/vectors/svg/af.svg",
    "vector-pdf": "assets/vectors/pdf/af.pdf",
    "vector-ai": "assets/vectors/ai/af.ai",
    "vector-eps": "assets/vectors/eps/af.eps",
    "image-w320-png": "assets/images/w320/af.png",
    "image-h80-webp": "assets/images/h80/af.webp",
    "icon-80x60-png": "assets/icons/80x60/af.png"
    // … 103 entries total per country (4 vector + 51 image + 48 icon)
  }
}
```

Field notes:

- `note` vs `description`: two different page elements. `note` = the yellow "Note:" box (only 19 pages, e.g. Afghanistan). `description` = the flag history/meaning paragraph (197 pages, e.g. Bangladesh). 38 small-territory pages (e.g. England, Åland) have neither on flagpedia itself — verified, not a scraping gap.
- `neighbors[].flag` points at the neighbor's local `h80` image (same size flagpedia shows).
- `flags` keys are `<kind>-<size>-<format>`; values are repo-relative local paths. Prefix with `/` to use as a URL (see Usage).

## Filename / country-code rules

Lowercase ISO 3166-1 alpha-2 (`us.svg`, `de.png`, `bd.json`), with two exceptions: `gb-eng` / `gb-sct` / `gb-wls` / `gb-nir` (ISO 3166-2:GB) and `xk` for Kosovo.

## Usage

The Go backend serves this whole folder statically, and the Next.js frontend proxies it — so every path below works both as a file path and (with a leading `/`) as a URL:

| Base | Example |
|---|---|
| Direct file | `assets/images/w320/bd.png` |
| Backend (:8080) | `http://localhost:8080/assets/images/w320/bd.png` |
| Frontend (:3000) | `http://localhost:3000/assets/data/bd.json` |

HTML:

```html
<img src="/assets/vectors/svg/bd.svg" alt="Flag of Bangladesh">
<img src="/assets/images/w320/bd.png" alt="Flag of Bangladesh">
<img src="/assets/icons/80x60/bd.webp" alt="Bangladesh icon">
```

JavaScript (country info + flags):

```js
const bd = await fetch('/assets/data/bd.json').then(r => r.json());
console.log(bd.meta.capital);            // "Dhaka"
console.log(bd.meta.description);        // flag history text
console.log(bd.flags['image-w640-png']); // "assets/images/w640/bd.png"
document.querySelector('img').src = '/' + bd.flags['vector-svg'];
```

Python (local file access):

```python
import json
bd = json.load(open('assets/data/bd.json', encoding='utf-8'))
print(bd['meta']['population'])   # "168 163 758 (2020)"
print(bd['flags']['icon-80x60-png'])  # "assets/icons/80x60/bd.png"
```

## Relation to other files

- `countries.json` (here in `assets/`) — the same dataset as one big file. `data/*.json` is generated from it (cleaned: no source URLs, paths only).
- `manifest.json` + download state — regenerated here in `assets/` by the backend on each download (last full run: `mode=all, done=26,162, failed=0`).
- `assets/shiny/` — leftover early demo from a non-Flagpedia mirror; incomplete and not part of this dataset (safe to delete).

## Regenerating

`assets/data/*.json` is derived from `assets/countries.json` (which the Go backend rewrites on each download via `persistDataset()`). After a re-download, regenerate the per-country files from `assets/countries.json`: copy each entry's `code`/`name`/`meta` (`flag_note` → `note`, plus `description`, enriched `neighbors`, `location`) and map its 103 `assets` entries to `{key: local_path}`.
