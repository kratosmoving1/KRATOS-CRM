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
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const placesLibraryRef = useRef<google.maps.PlacesLibrary | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

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
        placesLibraryRef.current = places;
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

  const fetchSuggestions = useCallback(async (query: string) => {
    const places = placesLibraryRef.current;
    const seq = ++requestSeqRef.current;

    if (!places || !query || query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    try {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      }

      const { suggestions: nextSuggestions } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['ca'],
          region: 'ca',
          sessionToken: sessionTokenRef.current,
        });

      if (seq !== requestSeqRef.current) return;

      const placePredictions = nextSuggestions
        .map((suggestion) => suggestion.placePrediction)
        .filter((prediction): prediction is google.maps.places.PlacePrediction => Boolean(prediction));

      setSuggestions(placePredictions);
      setIsOpen(placePredictions.length > 0);
      setHighlightedIndex(0);
      setErrorMessage(null);
    } catch (err) {
      console.warn('[AddressAutocomplete] Places API error:', err);
      if (seq !== requestSeqRef.current) return;
      setSuggestions([]);
      setIsOpen(false);
      setErrorMessage(`Places API: ${getGoogleErrorMessage(err)}`);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 250);
  }

  async function handleSelect(prediction: google.maps.places.PlacePrediction) {
    const description = prediction.text?.text || prediction.mainText?.text || '';
    setIsOpen(false);
    setSuggestions([]);
    onChange(description);

    try {
      const place = prediction.toPlace();
      const { place: placeDetails } = await place.fetchFields({
        fields: ['addressComponents', 'formattedAddress'],
      });

      const comps = placeDetails.addressComponents ?? [];
      const get = (type: string, short = false) => {
        const c = comps.find(x => x.types.includes(type));
        return c ? ((short ? c.shortText : c.longText) ?? '') : '';
      };
      const addressLine1 =
        [get('street_number'), get('route')].filter(Boolean).join(' ') ||
        prediction.mainText?.text ||
        '';
      const city =
        get('locality') ||
        get('sublocality_level_1') ||
        get('sublocality') ||
        get('postal_town');
      const province = get('administrative_area_level_1', true);
      const postalCode = get('postal_code');

      onSelect({
        fullAddress: placeDetails.formattedAddress || description,
        addressLine1,
        city,
        province,
        postalCode,
        placeId: prediction.placeId,
      });
      sessionTokenRef.current = null;
      setErrorMessage(null);
    } catch (err) {
      console.warn('[AddressAutocomplete] Place details error:', err);
      setErrorMessage(`Places API: ${getGoogleErrorMessage(err)}`);
      onSelect({
        fullAddress: description,
        addressLine1: description,
        city: '',
        province: '',
        postalCode: '',
        placeId: prediction.placeId,
      });
    }
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
              key={s.placeId}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-3 py-2.5 cursor-pointer text-sm border-b border-slate-100 last:border-0 ${
                idx === highlightedIndex ? 'bg-orange-50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-medium text-slate-900 leading-tight">
                {s.mainText?.text || s.text.text}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 leading-tight">
                {s.secondaryText?.text}
              </div>
            </li>
          ))}
        </ul>
      )}

      {errorMessage && <p className="text-xs text-red-500 mt-1">{errorMessage}</p>}
    </div>
  );
}

function getGoogleErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return 'Request failed';
}
