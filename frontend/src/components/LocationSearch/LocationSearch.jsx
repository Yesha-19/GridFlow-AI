import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, MapPin } from 'lucide-react';

/**
 * LocationSearch
 * Autocomplete search using OpenStreetMap Nominatim.
 * Debounces requests, shows loading/empty states, and calls onSelect
 * with { name, lat, lng, address } so the parent can synchronize
 * the dropdown, marker, and coordinate fields.
 */
export default function LocationSearch({ onSelect, selectedName }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);

  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = useCallback(async (value) => {
    if (!value || value.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: `${value}, Bengaluru, Karnataka, India`,
        format: 'json',
        limit: '6',
        addressdetails: '1',
        countrycodes: 'in',
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();

      const mapped = data.map((item) => ({
        id: item.place_id,
        name: item.name || item.display_name.split(',')[0],
        displayName: item.display_name,
        shortAddress: [item.address?.suburb, item.address?.city_district, item.address?.city]
          .filter(Boolean)
          .slice(0, 2)
          .join(', '),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        address: item.display_name,
        type: item.type,
      }));

      setResults(mapped);
      setIsOpen(true);
      setHighlightedIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function handleInputChange(e) {
    const value = e.target.value;
    setQuery(value);

    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => search(value), 350);
  }

  function handleSelect(result) {
    setQuery(result.name);
    setIsOpen(false);
    setResults([]);
    onSelect({
      name: result.name,
      lat: result.lat,
      lng: result.lng,
      address: result.address,
    });
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault();
      handleSelect(results[highlightedIdx]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIdx >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-item]');
      items[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIdx]);

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative flex items-center">
        <span className="pointer-events-none absolute left-3 text-console-muted">
          {isLoading ? (
            <Loader2 size={14} className="animate-spin text-signal" />
          ) : (
            <Search size={14} />
          )}
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="input pl-8 pr-8"
          placeholder="Search location, landmark, area, or address..."
          autoComplete="off"
          aria-label="Search location"
          aria-autocomplete="list"
          aria-expanded={isOpen}
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 text-console-muted transition-colors hover:text-console-text"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-[9999] mt-1 overflow-hidden rounded-md border border-console-border bg-console-panel shadow-xl">
          {results.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-5 text-center">
              <MapPin size={18} className="text-console-muted/50" />
              <p className="text-xs text-console-muted">No results found</p>
              <p className="text-[10px] text-console-muted/60">
                Try a different name or landmark
              </p>
            </div>
          ) : (
            <ul ref={listRef} role="listbox" className="max-h-52 overflow-y-auto scrollbar-console">
              {results.map((result, idx) => (
                <li
                  key={result.id}
                  data-item
                  role="option"
                  aria-selected={idx === highlightedIdx}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  onClick={() => handleSelect(result)}
                  className={`flex cursor-pointer items-start gap-2.5 border-b border-console-border/60 px-3 py-2.5 transition-colors last:border-0 ${
                    idx === highlightedIdx
                      ? 'bg-signal/10 text-console-text'
                      : 'text-console-text hover:bg-console-raised'
                  }`}
                >
                  <MapPin
                    size={13}
                    className={`mt-0.5 shrink-0 ${
                      idx === highlightedIdx ? 'text-signal' : 'text-console-muted'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{result.name}</p>
                    <p className="truncate text-[10px] text-console-muted">
                      {result.shortAddress || result.displayName.split(',').slice(1, 3).join(',')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}