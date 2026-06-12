'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type ParsedAddress = {
  fullAddress: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  placeId: string;
};

interface PlacePrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
  hasSelected?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className = '',
  hasSelected = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeqRef = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    const seq = ++reqSeqRef.current;
    if (!query || query.length < 2) { setSuggestions([]); setIsOpen(false); return; }

    try {
      const res = await fetch(`/api/admin/maps/autocomplete?input=${encodeURIComponent(query)}`);
      if (!res.ok || seq !== reqSeqRef.current) return;
      const data = await res.json();
      if (seq !== reqSeqRef.current) return;
      const preds: PlacePrediction[] = data.predictions ?? [];
      setSuggestions(preds);
      setIsOpen(preds.length > 0);
      setHighlightedIndex(0);
    } catch {
      // silent — don't block typing
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 250);
  }

  async function handleSelect(prediction: PlacePrediction) {
    const description = prediction.description;
    setIsOpen(false);
    setSuggestions([]);
    onChange(description);

    try {
      const res = await fetch(`/api/admin/maps/place-details?place_id=${encodeURIComponent(prediction.place_id)}`);
      if (!res.ok) {
        onSelect({ fullAddress: description, addressLine1: prediction.structured_formatting.main_text || description, city: '', province: '', postalCode: '', placeId: prediction.place_id });
        return;
      }
      const place = await res.json();
      if (!place?.address_components) {
        onSelect({ fullAddress: description, addressLine1: prediction.structured_formatting.main_text || description, city: '', province: '', postalCode: '', placeId: prediction.place_id });
        return;
      }
      const comps: Array<{ long_name: string; short_name: string; types: string[] }> = place.address_components;
      const get = (type: string, short = false) => {
        const c = comps.find(x => x.types.includes(type));
        return c ? (short ? c.short_name : c.long_name) : '';
      };
      const addressLine1 = [get('street_number'), get('route')].filter(Boolean).join(' ') || prediction.structured_formatting.main_text || '';
      const city = get('locality') || get('sublocality_level_1') || get('sublocality') || get('postal_town');
      const province = get('administrative_area_level_1', true);
      const postalCode = get('postal_code');
      onSelect({ fullAddress: place.formatted_address || description, addressLine1, city, province, postalCode, placeId: prediction.place_id });
    } catch {
      onSelect({ fullAddress: description, addressLine1: prediction.structured_formatting.main_text || description, city: '', province: '', postalCode: '', placeId: prediction.place_id });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); handleSelect(suggestions[highlightedIndex]); }
    else if (e.key === 'Escape') { setIsOpen(false); }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {hasSelected && !isOpen && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-sm select-none">✓</span>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-[200] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto">
          {suggestions.map((s, idx) => (
            <li
              key={s.place_id}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2.5 cursor-pointer text-sm border-b border-slate-100 last:border-0 ${idx === highlightedIndex ? 'bg-orange-50' : 'hover:bg-slate-50'}`}
            >
              <div className="font-medium text-slate-900 leading-tight">{s.structured_formatting.main_text}</div>
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">{s.structured_formatting.secondary_text}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
