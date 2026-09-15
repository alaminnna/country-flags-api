'use client';

import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Brain,
  CalendarDays,
  Compass,
  FlaskConical,
  GitCompareArrows,
  Home,
  Info,
  Link2,
  Moon,
  ScrollText,
  Sun,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Country } from '../lib/api';
import { findCountry, getCountries, matchesQuery } from '../lib/countries';
import { useCopy } from '../lib/hooks';
import { SPRING_MICRO } from '../lib/motion';

/** imperative opener — nav ⌘K button, hero, anywhere */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent('open-command-palette'));
}

const PAGES = [
  { label: 'Home', hint: 'Landing + search', href: '/', Icon: Home },
  { label: 'Explore', hint: 'Browse all 254 countries', href: '/explore', Icon: Compass },
  { label: 'Quiz', hint: 'Seeded flag quizzes', href: '/quiz', Icon: Brain },
  { label: 'Daily Challenge', hint: "Today's shared quiz", href: '/quiz', Icon: CalendarDays },
  { label: 'Compare', hint: 'Side-by-side metadata', href: '/compare', Icon: GitCompareArrows },
  { label: 'API Docs', hint: 'Endpoints + caching', href: '/docs', Icon: ScrollText },
  { label: 'Playground', hint: 'Try the resolver live', href: '/playground', Icon: FlaskConical },
  { label: 'About', hint: 'What this platform is', href: '/about', Icon: Info },
];

/** shown when the query is empty — avoids rendering all 254 rows */
const POPULAR = ['us', 'gb', 'de', 'fr', 'jp', 'in', 'br', 'ca', 'au', 'es', 'bd', 'it'];

function CountryRow({ country }: { country: Country }) {
  return (
    <>
      <span className="palette-thumb" aria-hidden>
        <img src={`/assets/v1/images/w80/${country.code}.png`} alt="" loading="lazy" decoding="async" />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{country.name}</span>
      <span className="chip chip-iso">{country.code}</span>
    </>
  );
}

/**
 * Command palette — ⌘K / Ctrl+K or click. Sections: Pages, Countries
 * (fuzzy live search across all 254, flag thumb + name + ISO chip),
 * Actions (toggle theme, copy API base URL). Arrow keys, Enter, Esc.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const router = useRouter();
  const reduce = useReducedMotion();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { copy } = useCopy();

  useEffect(() => {
    const toggle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const external = () => setOpen(true);
    window.addEventListener('keydown', toggle);
    window.addEventListener('open-command-palette', external);
    return () => {
      window.removeEventListener('keydown', toggle);
      window.removeEventListener('open-command-palette', external);
    };
  }, []);

  // lazy-load the country index on first open; shared memory cache afterwards
  useEffect(() => {
    if (open && countries.length === 0) {
      getCountries().then(setCountries);
    }
    if (!open) setQuery('');
  }, [open, countries.length]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const countryItems = useMemo(() => {
    const nq = query.trim().toLowerCase();
    if (!nq) return POPULAR.map((c) => findCountry(countries, c)).filter((c): c is Country => !!c);
    return countries.filter((c) => matchesQuery(c, nq)).slice(0, 30);
  }, [countries, query]);

  const activeTheme = theme === 'system' ? resolvedTheme : theme;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -8 }}
            transition={SPRING_MICRO}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(620px, 100%)' }}
          >
            <Command
              label="Command menu"
              className="palette"
              shouldFilter={false}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
              }}
            >
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search pages, countries, actions…"
                autoFocus
              />
              <Command.List>
                <Command.Empty>No results. Try a name or ISO code like “bd”.</Command.Empty>
                <Command.Group heading="Pages">
                  {PAGES.map((p) => (
                    <Command.Item key={p.href} value={p.label} onSelect={() => go(p.href)}>
                      <p.Icon size={16} className="shrink-0 text-soft" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.label}</span>
                      <span className="truncate text-[0.75rem] text-soft">{p.hint}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                {countryItems.length > 0 && (
                  <Command.Group heading={query ? 'Countries' : 'Popular countries'}>
                    {countryItems.map((c) => (
                      <Command.Item
                        key={c.code}
                        value={`${c.name} ${c.code}`}
                        onSelect={() => go(`/country/${c.code}`)}
                      >
                        <CountryRow country={c} />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                <Command.Group heading="Actions">
                  <Command.Item
                    value="toggle theme"
                    onSelect={() => {
                      setTheme(activeTheme === 'dark' ? 'light' : 'dark');
                      setOpen(false);
                    }}
                  >
                    {activeTheme === 'dark' ? (
                      <Sun size={16} className="shrink-0 text-soft" aria-hidden />
                    ) : (
                      <Moon size={16} className="shrink-0 text-soft" aria-hidden />
                    )}
                    <span className="flex-1 font-medium">Toggle theme</span>
                    <span className="text-[0.75rem] text-soft">currently {activeTheme}</span>
                  </Command.Item>
                  <Command.Item
                    value="copy api base url"
                    onSelect={() => {
                      copy(window.location.origin);
                      setOpen(false);
                    }}
                  >
                    <Link2 size={16} className="shrink-0 text-soft" aria-hidden />
                    <span className="flex-1 font-medium">Copy API base URL</span>
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
