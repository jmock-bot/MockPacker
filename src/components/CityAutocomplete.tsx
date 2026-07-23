import { useEffect, useId, useRef, useState } from 'react';
import { searchCities, type GeoResult } from '../lib/weather';

/**
 * Accessible city autocomplete (WAI-ARIA combobox). Queries Open-Meteo's
 * keyless geocoding API as the user types, debounced, cancelling stale
 * requests. Picking a suggestion reports the full place (city, region,
 * country, lat/lon) so callers can fill related fields and skip a second
 * geocode. Free typing is still allowed — selection is optional.
 */
export function CityAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  id?: string;
  value: string;
  /** Fires on every keystroke (free text). */
  onChange: (city: string) => void;
  /** Fires when a suggestion is chosen. */
  onSelect: (place: GeoResult) => void;
  placeholder?: string;
}) {
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const justSelected = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Debounced search; cancels the previous request when the query changes.
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const t = window.setTimeout(() => {
      void searchCities(q, 6, controller.signal).then((r) => {
        // searchCities swallows AbortError and resolves with [] — indistinguishable
        // from a genuine "no results". Without this guard, an aborted (stale)
        // request's resolution can land after a newer request has already started,
        // flashing "No matches" right before the real results arrive. Discard
        // results from any request this effect has already superseded.
        if (controller.signal.aborted) return;
        setResults(r);
        setActive(-1);
        setOpen(true);
        setLoading(false);
      });
    }, 250);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [value]);

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (place: GeoResult) => {
    justSelected.current = true;
    onChange(place.name);
    onSelect(place);
    setOpen(false);
    setResults([]);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const inputClass =
    'min-h-[44px] w-full rounded-xl border border-line bg-card px-3 text-base text-ink placeholder:text-ink-faint focus:border-maroon focus:outline-none focus:ring-2 focus:ring-maroon/15';

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        className={inputClass}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
      />
      {loading && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-maroon"
        />
      )}
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-card py-1 shadow-raised"
        >
          {results.map((p, i) => (
            <li
              key={`${p.lat},${p.lon}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? 'bg-maroon-tint text-maroon' : 'text-ink-soft'
              }`}
            >
              <span className="font-medium text-ink">{p.name}</span>
              {(p.region || p.country) && (
                <span className="text-ink-faint"> · {[p.region, p.country].filter(Boolean).join(', ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && value.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink-faint shadow-raised">
          No matches — you can still type the city name.
        </div>
      )}
    </div>
  );
}
