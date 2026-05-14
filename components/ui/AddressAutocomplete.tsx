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

// Module-level singletons — load once per page session
let loadPromise: Promise<google.maps.PlacesLibrary> | null = null;
let autocompleteService: google.maps.places.AutocompleteService | null = null;
let placesService: google.maps.places.PlacesService | null = null;

function getPlaces(): Promise<google.maps.PlacesLibrary> {
  if (!loadPromise) {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      loadPromise = Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set'));
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    getPlaces()
      .then((places) => {
        if (!autocompleteService) {
          autocompleteService = new places.AutocompleteService();
        }
        if (!placesService) {
          const hiddenDiv = document.createElement('div');
          placesService = new places.PlacesService(hiddenDiv);
        }
        setIsReady(true);
      })
      .catch((err: Error) => {
        setLoadError(err.message || 'Failed to load address autocomplete');
      });
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
    if (!autocompleteService || !query || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    autocompleteService.getPlacePredictions(
      { input: query, componentRestrictions: { country: 'ca' } },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSuggestions(predictions);
          setIsOpen(true);
          setHighlightedIndex(0);
        } else {
          setSuggestions([]);
          setIsOpen(false);
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

    if (!placesService) {
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

    placesService.getDetails(
      { placeId: prediction.place_id, fields: ['address_components', 'formatted_address'] },
      (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
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
            loadError ? 'Enter address manually' : isReady ? placeholder : 'Loading...'
          }
          className={className}
          disabled={!isReady && !loadError}
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

      {loadError && <p className="text-xs text-red-500 mt-1">{loadError}</p>}
    </div>
  );
}
