'use client';

import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ParsedAddress = {
  fullAddress: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  placeId: string;
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
  hasSelected?: boolean;
}

let loadPromise: Promise<google.maps.PlacesLibrary | null> | null = null;

function getPlaces(): Promise<google.maps.PlacesLibrary | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!loadPromise) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('[AddressAutocomplete] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
      loadPromise = Promise.resolve(null);
    } else {
      setOptions({ key: apiKey, v: 'weekly' });
      loadPromise = importLibrary('places') as Promise<google.maps.PlacesLibrary>;
    }
  }
  return loadPromise!;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className = '',
  hasSelected = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlaces()
      .then((places) => {
        if (cancelled) return;
        if (!places) {
          setLoadStatus('error');
          setErrorMessage('Address autocomplete unavailable — API key not configured.');
          return;
        }
        autocompleteServiceRef.current = new places.AutocompleteService();
        const hiddenDiv = document.createElement('div');
        placesServiceRef.current = new places.PlacesService(hiddenDiv);
        setLoadStatus('ready');
        setErrorMessage(null);
      })
      .catch((err) => {
        console.error('[AddressAutocomplete] load error:', err);
        if (!cancelled) {
          setLoadStatus('error');
          setErrorMessage('Address autocomplete failed to load. Check console.');
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const fetchSuggestions = useCallback((query: string) => {
    if (!autocompleteServiceRef.current || !query || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    autocompleteServiceRef.current.getPlacePredictions(
      { input: query, componentRestrictions: { country: 'ca' } },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setIsOpen(true);
          setHighlightedIndex(0);
          setErrorMessage(null);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          setSuggestions([]);
          setIsOpen(false);
        } else {
          console.warn('[AddressAutocomplete] Places API status:', status);
          setSuggestions([]);
          setIsOpen(false);
          setErrorMessage(`Places API: ${status}`);
        }
      }
    );
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 250);
  }

  function handleSelect(prediction: google.maps.places.AutocompletePrediction) {
    setIsOpen(false);
    setSuggestions([]);
    onChange(prediction.description);

    if (!placesServiceRef.current) {
      onSelect({
        fullAddress: prediction.description,
        addressLine1: prediction.description,
        city: '',
        province: '',
        postalCode: '',
        placeId: prediction.place_id,
      });
      return;
    }

    placesServiceRef.current.getDetails(
      { placeId: prediction.place_id, fields: ['address_components', 'formatted_address'] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          if (status !== google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            console.warn('[AddressAutocomplete] Place details status:', status);
            setErrorMessage(`Places API: ${status}`);
          }
          onSelect({
            fullAddress: prediction.description,
            addressLine1: prediction.description,
            city: '',
            province: '',
            postalCode: '',
            placeId: prediction.place_id,
          });
          return;
        }
        const comps = place.address_components ?? [];
        const get = (type: string, short = false) => {
          const c = comps.find(x => x.types.includes(type));
          return c ? (short ? c.short_name : c.long_name) : '';
        };
        const addressLine1 =
          [get('street_number'), get('route')].filter(Boolean).join(' ') ||
          prediction.structured_formatting?.main_text ||
          '';
        const city =
          get('locality') ||
          get('sublocality_level_1') ||
          get('sublocality') ||
          get('postal_town');
        const province = get('administrative_area_level_1', true); // "ON" not "Ontario"
        const postalCode = get('postal_code');
        onSelect({
          fullAddress: place.formatted_address || prediction.description,
          addressLine1,
          city,
          province,
          postalCode,
          placeId: prediction.place_id,
        });
        setErrorMessage(null);
      }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
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
          placeholder={
            loadStatus === 'loading' ? 'Loading address autocomplete…' : placeholder
          }
          className={className}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {hasSelected && !isOpen && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-sm select-none">
            ✓
          </span>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-[200] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-auto">
          {suggestions.map((s, idx) => (
            <li
              key={s.place_id}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2.5 cursor-pointer text-sm border-b border-slate-100 last:border-0 ${
                idx === highlightedIndex ? 'bg-orange-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-medium text-slate-900 leading-tight">
                {s.structured_formatting?.main_text}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">
                {s.structured_formatting?.secondary_text}
              </div>
            </li>
          ))}
        </ul>
      )}

      {errorMessage && <p className="text-xs text-red-500 mt-1">{errorMessage}</p>}
    </div>
  );
}
