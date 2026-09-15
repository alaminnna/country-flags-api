package meta

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// Neighbor is a bordering country reference.
type Neighbor struct {
	Name string `json:"name"`
	Code string `json:"code"`
	Flag string `json:"flag"`
}

// Location holds map code.
type Location struct {
	MapCode string `json:"map_code"`
}

// Meta holds all per-country metadata fields from assets/data/*.json.
type Meta struct {
	Title          string     `json:"title"`
	Note           string     `json:"note"`
	Description    string     `json:"description"`
	Emoji          string     `json:"emoji"`
	EmojiLabel     string     `json:"emoji_label"`
	SovereignState string     `json:"sovereign_state"`
	CountryCodes   string     `json:"country_codes"`
	OfficialName   string     `json:"official_name"`
	Capital        string     `json:"capital"`
	Continent      string     `json:"continent"`
	MemberOf       []string   `json:"member_of"`
	Population     string     `json:"population"`
	Area           string     `json:"area"`
	HighestPoint   string     `json:"highest_point"`
	LowestPoint    string     `json:"lowest_point"`
	GDPPerCapita   string     `json:"gdp_per_capita"`
	Currency       string     `json:"currency"`
	CallingCode    string     `json:"calling_code"`
	TLD            string     `json:"tld"`
	Neighbors      []Neighbor `json:"neighbors"`
	Location       Location   `json:"location"`
}

// Country is one record from assets/data/<code>.json.
type Country struct {
	Code  string            `json:"code"`
	Name  string            `json:"name"`
	Meta  Meta              `json:"meta"`
	Flags map[string]string `json:"flags"`
}

// Store holds all loaded countries and lookup indexes. Read-only after Load.
type Store struct {
	All       []*Country
	ByISO2    map[string]*Country
	ByISO3    map[string]string // iso3(lower) -> iso2
	ByNumeric map[string]string // m49 numeric -> iso2
	ByName    map[string]*Country
	ByRegion  map[string][]*Country // lower(continent) -> countries

	// Precomputed serialized responses (raw + gzip).
	ListJSON   []byte
	ListJSONGZ []byte
	OneJSON    map[string][]byte // iso2 -> raw
	OneJSONGZ  map[string][]byte // iso2 -> gzip
}

// aliases maps normalized alias -> iso2.
var aliases = map[string]string{
	"usa":                      "us",
	"united states":            "us",
	"united states of america": "us",
	"uae":                      "ae",
	"united arab emirates":     "ae",
	"uk":                       "gb",
	"great britain":            "gb",
	"britain":                  "gb",
	"england":                  "gb-eng",
	"scotland":                 "gb-sct",
	"wales":                    "gb-wls",
	"northern ireland":         "gb-nir",
	"czechia":                  "cz",
	"czech republic":           "cz",
	"russia":                   "ru",
	"russian federation":       "ru",
	"south korea":              "kr",
	"republic of korea":        "kr",
	"north korea":              "kp",
	"vietnam":                  "vn",
	"viet nam":                 "vn",
	"iran":                     "ir",
	"syria":                    "sy",
	"laos":                     "la",
	"moldova":                  "md",
	"vatican":                  "va",
	"vatican city":             "va",
	"holy see":                 "va",
	"bolivia":                  "bo",
	"venezuela":                "ve",
	"tanzania":                 "tz",
	"brunei":                   "bn",
	"kosovo":                   "xk",
	"swaziland":                "sz",
	"eswatini":                 "sz",
	"burma":                    "mm",
	"myanmar":                  "mm",
	"cote divoire":             "ci",
	"ivory coast":              "ci",
	"cape verde":               "cv",
	"cabo verde":               "cv",
	"east timor":               "tl",
	"timor leste":              "tl",
	"palestine":                "ps",
	"macau":                    "mo",
	"macao":                    "mo",
}

// numericISO maps numeric M49 string -> iso2 lower.
var numericISO = map[string]string{
	"004": "af", "008": "al", "012": "dz", "020": "ad", "024": "ao", "660": "ai",
	"010": "aq", "028": "ag", "032": "ar", "051": "am", "533": "aw", "036": "au",
	"040": "at", "031": "az", "044": "bs", "048": "bh", "050": "bd", "052": "bb",
	"112": "by", "056": "be", "084": "bz", "204": "bj", "060": "bm", "064": "bt",
	"068": "bo", "070": "ba", "072": "bw", "076": "br", "096": "bn", "100": "bg",
	"854": "bf", "108": "bi", "116": "kh", "120": "cm", "124": "ca", "140": "cf",
	"148": "td", "152": "cl", "156": "cn", "170": "co", "174": "km", "178": "cg",
	"180": "cd", "184": "ck", "188": "cr", "384": "ci", "191": "hr", "192": "cu",
	"196": "cy", "203": "cz", "208": "dk", "262": "dj", "212": "dm", "214": "do",
	"218": "ec", "818": "eg", "222": "sv", "226": "gq", "231": "et", "238": "fk",
	"234": "fo", "242": "fj", "246": "fi", "250": "fr", "254": "gf",
	"258": "pf", "260": "tf", "266": "ga", "270": "gm", "268": "ge", "276": "de",
	"288": "gh", "292": "gi", "300": "gr", "304": "gl", "308": "gd", "312": "gp",
	"316": "gu", "320": "gt", "324": "gn", "624": "gw", "328": "gy", "332": "ht",
	"334": "hm", "336": "va", "340": "hn", "344": "hk", "348": "hu", "352": "is",
	"356": "in", "360": "id", "364": "ir", "368": "iq", "372": "ie", "376": "il",
	"380": "it", "388": "jm", "392": "jp", "400": "jo", "398": "kz", "404": "ke",
	"296": "ki", "408": "kp", "410": "kr", "414": "kw", "417": "kg", "418": "la",
	"428": "lv", "422": "lb", "426": "ls", "430": "lr", "434": "ly", "438": "li",
	"440": "lt", "442": "lu", "446": "mo", "807": "mk", "450": "mg", "454": "mw",
	"458": "my", "462": "mv", "466": "ml", "470": "mt", "584": "mh", "474": "mq",
	"478": "mr", "480": "mu", "175": "yt", "484": "mx", "583": "fm", "498": "md",
	"492": "mc", "496": "mn", "499": "me", "500": "ms", "504": "ma", "508": "mz",
	"104": "mm", "516": "na", "520": "nr", "524": "np", "528": "nl", "540": "nc",
	"554": "nz", "558": "ni", "562": "ne", "566": "ng", "570": "nu", "578": "no",
	"512": "om", "586": "pk", "585": "pw", "275": "ps", "591": "pa", "598": "pg",
	"600": "py", "604": "pe", "608": "ph", "612": "pn", "616": "pl", "620": "pt",
	"630": "pr", "634": "qa", "638": "re", "642": "ro", "643": "ru", "646": "rw",
	"652": "bl", "654": "sh", "659": "kn", "662": "lc", "663": "mf",
	"666": "pm", "670": "vc", "674": "sm", "678": "st", "682": "sa", "686": "sn",
	"688": "rs", "694": "sl", "703": "sk", "705": "si", "090": "sb", "706": "so",
	"710": "za", "239": "gs", "724": "es", "144": "lk", "729": "sd", "740": "sr",
	"744": "sj", "748": "sz", "752": "se", "756": "ch", "760": "sy", "158": "tw",
	"762": "tj", "764": "th", "626": "tl", "768": "tg", "772": "tk", "776": "to",
	"780": "tt", "788": "tn", "792": "tr", "795": "tm", "796": "tc", "798": "tv",
	"800": "ug", "804": "ua", "784": "ae", "826": "gb", "840": "us", "581": "um",
	"858": "uy", "860": "uz", "548": "vu", "862": "ve", "704": "vn",
	"092": "vg", "850": "vi", "876": "wf", "732": "eh", "887": "ye", "894": "zm",
	"716": "zw", "022": "bq", "531": "cw", "534": "sx",
}

// diacriticFold replaces common accented runes with ASCII equivalents.
func diacriticFold(s string) string {
	repl := strings.NewReplacer(
		"à", "a", "á", "a", "â", "a", "ã", "a", "ä", "a", "å", "a", "ā", "a", "ă", "a", "ą", "a",
		"ç", "c", "ć", "c", "č", "c",
		"ď", "d", "đ", "d",
		"è", "e", "é", "e", "ê", "e", "ë", "e", "ē", "e", "ė", "e", "ę", "e",
		"ĝ", "g", "ğ", "g",
		"ĥ", "h",
		"ì", "i", "í", "i", "î", "i", "ï", "i", "ī", "i", "į", "i",
		"ĵ", "j",
		"ķ", "k",
		"ĺ", "l", "ļ", "l", "ľ", "l", "ł", "l",
		"ñ", "n", "ń", "n", "ņ", "n",
		"ò", "o", "ó", "o", "ô", "o", "õ", "o", "ö", "o", "ø", "o", "ō", "o",
		"ř", "r",
		"ś", "s", "ŝ", "s", "ş", "s", "š", "s",
		"ţ", "t", "ť", "t",
		"ù", "u", "ú", "u", "û", "u", "ü", "u", "ū", "u", "ů", "u",
		"ŵ", "w",
		"ý", "y", "ÿ", "y",
		"ź", "z", "ż", "z", "ž", "z",
		"ß", "ss", "æ", "ae", "œ", "oe",
		"’", "", "'", "", "`", "", "´", "",
	)
	return repl.Replace(strings.ToLower(s))
}

// Normalize lowercases, folds diacritics, trims spaces.
func Normalize(s string) string {
	s = diacriticFold(s)
	s = strings.TrimSpace(s)
	// collapse internal whitespace
	s = strings.Join(strings.Fields(s), " ")
	return s
}

// parseISO3 extracts ISO3 from country_codes like "BD, BGD (ISO 3166-1)".
func parseISO3(countryCodes string) string {
	// split by comma, take second token letters
	parts := strings.Split(countryCodes, ",")
	if len(parts) < 2 {
		return ""
	}
	second := strings.TrimSpace(parts[1])
	// second looks like "BGD (ISO 3166-1)" or "GB-ENG (ISO..." (handled elsewhere)
	fields := strings.Fields(second)
	if len(fields) == 0 {
		return ""
	}
	cand := strings.ToLower(fields[0])
	// must be exactly 3 alpha letters
	if len(cand) == 3 {
		ok := true
		for _, r := range cand {
			if r < 'a' || r > 'z' {
				ok = false
				break
			}
		}
		if ok {
			return cand
		}
	}
	return ""
}

// Load reads assets/data/*.json and builds indexes + precomputed responses.
func Load(assetsDir string) (*Store, error) {
	dataDir := filepath.Join(assetsDir, "data")
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		return nil, fmt.Errorf("read data dir: %w", err)
	}
	s := &Store{
		ByISO2:    make(map[string]*Country),
		ByISO3:    make(map[string]string),
		ByNumeric: make(map[string]string),
		ByName:    make(map[string]*Country),
		ByRegion:  make(map[string][]*Country),
		OneJSON:   make(map[string][]byte),
		OneJSONGZ: make(map[string][]byte),
	}
	for k, v := range numericISO {
		// normalize numeric: strip leading zeros? keep both padded and unpadded
		s.ByNumeric[k] = v
		trimmed := strings.TrimLeft(k, "0")
		if trimmed == "" {
			trimmed = "0"
		}
		if _, ok := s.ByNumeric[trimmed]; !ok {
			s.ByNumeric[trimmed] = v
		}
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dataDir, e.Name()))
		if err != nil {
			return nil, err
		}
		var c Country
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		if err := dec.Decode(&c); err != nil {
			return nil, fmt.Errorf("parse %s: %w", e.Name(), err)
		}
		c.Code = strings.ToLower(strings.TrimSpace(c.Code))
		cp := c
		s.All = append(s.All, &cp)
	}
	// sort alphabetical by common name
	sort.Slice(s.All, func(i, j int) bool { return s.All[i].Name < s.All[j].Name })
	// rebuild pointers after sort? All entries are distinct pointers already.
	for _, c := range s.All {
		iso2 := strings.ToLower(c.Code)
		s.ByISO2[iso2] = c
		if iso3 := parseISO3(c.Meta.CountryCodes); iso3 != "" {
			if _, ok := s.ByISO3[iso3]; !ok {
				s.ByISO3[iso3] = iso2
			}
		}
		nname := Normalize(c.Name)
		if _, ok := s.ByName[nname]; !ok {
			s.ByName[nname] = c
		}
		// official name also searchable
		if on := Normalize(c.Meta.OfficialName); on != "" {
			if _, ok := s.ByName[on]; !ok {
				s.ByName[on] = c
			}
		}
		region := strings.ToLower(strings.TrimSpace(c.Meta.Continent))
		if region == "" {
			region = "unknown"
		}
		s.ByRegion[region] = append(s.ByRegion[region], c)
	}
	// aliases (don't overwrite real names)
	for alias, iso2 := range aliases {
		if _, ok := s.ByName[alias]; !ok {
			if c, ok := s.ByISO2[iso2]; ok {
				s.ByName[alias] = c
			}
		}
	}
	// precompute list JSON
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(s.All); err != nil {
		return nil, err
	}
	s.ListJSON = bytes.TrimRight(buf.Bytes(), "\n")
	s.ListJSONGZ = gzipBytes(s.ListJSON)
	for _, c := range s.All {
		var b bytes.Buffer
		e := json.NewEncoder(&b)
		e.SetEscapeHTML(false)
		if err := e.Encode(c); err != nil {
			return nil, err
		}
		raw := bytes.TrimRight(b.Bytes(), "\n")
		s.OneJSON[strings.ToLower(c.Code)] = raw
		s.OneJSONGZ[strings.ToLower(c.Code)] = gzipBytes(raw)
	}
	return s, nil
}

// LookupCode normalizes ISO2/ISO3/numeric (case-insensitive) to iso2.
func (s *Store) LookupCode(code string) (*Country, bool) {
	c := strings.ToLower(strings.TrimSpace(code))
	if v, ok := s.ByISO2[c]; ok {
		return v, true
	}
	if iso2, ok := s.ByISO3[c]; ok {
		if v, ok := s.ByISO2[iso2]; ok {
			return v, true
		}
	}
	// numeric: allow "004" or "4"
	trimmed := strings.TrimLeft(c, "0")
	if trimmed == "" {
		trimmed = "0"
	}
	if iso2, ok := s.ByNumeric[c]; ok {
		if v, ok := s.ByISO2[iso2]; ok {
			return v, true
		}
	}
	if iso2, ok := s.ByNumeric[trimmed]; ok {
		if v, ok := s.ByISO2[iso2]; ok {
			return v, true
		}
	}
	return nil, false
}

// Search returns countries whose normalized name/alias/code contains q.
func (s *Store) Search(q string) []*Country {
	nq := Normalize(q)
	if nq == "" {
		return nil
	}
	var out []*Country
	for _, c := range s.All {
		if strings.Contains(Normalize(c.Name), nq) ||
			strings.Contains(Normalize(c.Meta.OfficialName), nq) ||
			strings.Contains(strings.ToLower(c.Code), nq) {
			out = append(out, c)
			continue
		}
		// alias hit: if query equals an alias mapping to this country
		if iso, ok := aliases[nq]; ok && iso == strings.ToLower(c.Code) {
			out = append(out, c)
		}
	}
	return out
}
