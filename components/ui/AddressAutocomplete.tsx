'use client';

import { useEffect, useRef, useState } from 'react';
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete';

export type AddressFields = {
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (fields: AddressFields) => void;
  placeholder?: string;
  className?: string;
}

let scriptLoading = false;
let scriptLoaded = false;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (scriptLoaded) return resolve();
    if (scriptLoading) {
      const i = setInterval(() => {
        if (scriptLoaded) { clearInterval(i); resolve(); }
      }, 100);
      return;
    }
    scriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => { scriptLoaded = true; scriptLoading = false; resolve(); };
    script.onerror = (err) => { scriptLoading = false; reject(err); };
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder = 'Start typing an address...', className }: Props) {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      setLoadError('Google Maps API key not configured');
      return;
    }
    loadGoogleMapsScript(key)
      .then(() => setIsReady(true))
      .catch(() => setLoadError('Failed to load address autocomplete'));
  }, []);

  if (loadError) {
    return (
      <div>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className={className} autoComplete="off" />
        <p className="mt-1 text-xs text-red-500">{loadError}</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder="Loading..." className={className} autoComplete="off" disabled />
    );
  }

  return <AutocompleteInner value={value} onChange={onChange} onSelect={onSelect} placeholder={placeholder} className={className} />;
}

function AutocompleteInner({ value: externalValue, onChange, onSelect, placeholder, className }: Props) {
  const {
    ready, value, suggestions: { status, data }, setValue, clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: { componentRestrictions: { country: 'ca' } },
    debounce: 300,
    defaultValue: externalValue,
  });

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (externalValue !== value) setValue(externalValue, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalValue]);

  useEffect(() => {
    setOpen(status === 'OK' && data.length > 0);
  }, [status, data]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSelect(description: string, placeId: string) {
    setValue(description, false);
    clearSuggestions();
    setOpen(false);
    onChange(description);

    try {
      const details = (await getDetails({
        placeId,
        fields: ['address_components'],
      })) as { address_components?: google.maps.GeocoderAddressComponent[] };

      const comps = details.address_components ?? [];
      const get = (type: string) => comps.find(c => c.types.includes(type))?.long_name ?? '';

      onSelect({
        addressLine1: [get('street_number'), get('route')].filter(Boolean).join(' ') || description,
        city:    get('locality') || get('sublocality') || get('postal_town'),
        province: get('administrative_area_level_1'),
        postalCode: get('postal_code'),
      });
    } catch {
      onSelect({ addressLine1: description, city: '', province: '', postalCode: '' });
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        value={value}
        onChange={e => { setValue(e.target.value); onChange(e.target.value); }}
        disabled={!ready}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        onFocus={() => { if (status === 'OK' && data.length > 0) setOpen(true); }}
      />
      {open && (
        <ul className="absolute z-[100] mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {data.map(({ place_id, description, structured_formatting }) => (
            <li
              key={place_id}
              onMouseDown={e => { e.preventDefault(); handleSelect(description, place_id); }}
              className="cursor-pointer border-b border-slate-100 px-3 py-2.5 last:border-0 hover:bg-orange-50"
            >
              <p className="text-sm font-medium text-slate-800 leading-tight">
                {structured_formatting.main_text}
              </p>
              <p className="text-xs text-slate-400 leading-tight mt-0.5">
                {structured_formatting.secondary_text}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
