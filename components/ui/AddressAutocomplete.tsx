'use client';

import { useEffect, useState } from 'react';
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete';
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
} from '@reach/combobox';
import '@reach/combobox/styles.css';

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
        if (scriptLoaded) {
          clearInterval(i);
          resolve();
        }
      }, 100);
      return;
    }
    scriptLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
    };
    script.onerror = (err) => {
      scriptLoading = false;
      reject(err);
    };
    document.head.appendChild(script);
  });
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className,
}: Props) {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) {
      setLoadError('Google Maps API key not configured');
      console.error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set');
      return;
    }
    loadGoogleMapsScript(key)
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
        setLoadError('Failed to load address autocomplete');
      });
  }, []);

  if (loadError) {
    return (
      <div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-red-500">{loadError}</p>
      </div>
    );
  }

  if (!isReady) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Loading address autocomplete..."
        className={className}
        autoComplete="off"
        disabled
      />
    );
  }

  return (
    <AutocompleteInner
      value={value}
      onChange={onChange}
      onSelect={onSelect}
      placeholder={placeholder}
      className={className}
    />
  );
}

function AutocompleteInner({
  value: externalValue,
  onChange,
  onSelect,
  placeholder,
  className,
}: Props) {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: { componentRestrictions: { country: 'ca' } },
    debounce: 300,
    defaultValue: externalValue,
  });

  useEffect(() => {
    if (externalValue !== value) setValue(externalValue, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalValue]);

  const handleSelect = async (description: string, placeId: string) => {
    setValue(description, false);
    clearSuggestions();
    onChange(description);

    try {
      const details = (await getDetails({
        placeId,
        fields: ['address_components', 'formatted_address'],
      })) as google.maps.places.PlaceResult;

      const components = details.address_components || [];
      const get = (type: string) =>
        components.find((c) => c.types.includes(type))?.long_name || '';

      const streetNumber = get('street_number');
      const route = get('route');
      const addressLine1 =
        [streetNumber, route].filter(Boolean).join(' ') || description;
      const city =
        get('locality') || get('sublocality') || get('postal_town');
      const province = get('administrative_area_level_1');
      const postalCode = get('postal_code');

      onSelect({ addressLine1, city, province, postalCode });
    } catch (err) {
      console.error('Place details error:', err);
      onSelect({ addressLine1: description, city: '', province: '', postalCode: '' });
    }
  };

  return (
    <Combobox
      onSelect={(val) => {
        const match = data.find((s) => s.description === val);
        if (match) handleSelect(val, match.place_id);
      }}
    >
      <ComboboxInput
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
        disabled={!ready}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      <ComboboxPopover className="z-[100] mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
        <ComboboxList>
          {status === 'OK' &&
            data.map(({ place_id, description }) => (
              <ComboboxOption
                key={place_id}
                value={description}
                className="cursor-pointer border-b border-slate-100 px-3 py-2.5 text-sm last:border-0 hover:bg-orange-50"
              />
            ))}
          {status === 'ZERO_RESULTS' && (
            <li className="px-3 py-2 text-sm text-slate-500">
              No matches — keep typing or enter manually
            </li>
          )}
        </ComboboxList>
      </ComboboxPopover>
    </Combobox>
  );
}
