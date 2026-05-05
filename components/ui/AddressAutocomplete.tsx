'use client'

import { useEffect } from 'react'
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete'

export interface AddressParts {
  address_1: string
  city: string
  province: string
  postal_code: string
}

interface Props {
  label: string
  value: string
  onChange: (val: string) => void
  onSelect: (parts: AddressParts) => void
  placeholder?: string
  error?: string
}

interface AddressComponent {
  types: string[]
  long_name: string
  short_name: string
}

function getComponent(
  components: AddressComponent[],
  type: string,
  form: 'long_name' | 'short_name' = 'long_name',
) {
  return components.find(c => c.types.includes(type))?.[form] ?? ''
}

export default function AddressAutocomplete({
  label, value, onChange, onSelect, placeholder, error,
}: Props) {
  const {
    ready,
    value: inputVal,
    setValue,
    suggestions: { status, data },
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      componentRestrictions: { country: ['ca', 'us'] },
      types: ['address'],
    },
    debounce: 300,
    initOnMount: typeof window !== 'undefined' && !!(window as Window & typeof globalThis & { google?: unknown }).google,
  })

  useEffect(() => {
    setValue(value, false)
  }, [value, setValue])

  async function handleSelect(description: string, placeId: string) {
    setValue(description, false)
    clearSuggestions()
    try {
      const result = await getDetails({
        placeId,
        fields: ['address_components'],
      }) as { address_components?: AddressComponent[] }
      const comps = result.address_components ?? []
      const streetNumber = getComponent(comps, 'street_number')
      const route = getComponent(comps, 'route')
      const city =
        getComponent(comps, 'locality') ||
        getComponent(comps, 'sublocality_level_1') ||
        getComponent(comps, 'administrative_area_level_2')
      const province = getComponent(comps, 'administrative_area_level_1', 'short_name')
      const postal_code = getComponent(comps, 'postal_code')
      onSelect({
        address_1: [streetNumber, route].filter(Boolean).join(' '),
        city,
        province,
        postal_code,
      })
    } catch {
      onSelect({ address_1: description, city: '', province: '', postal_code: '' })
    }
  }

  const baseInput =
    'w-full rounded-lg border px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-kratos/20 transition-colors'
  const borderClass = error
    ? 'border-red-400 focus:border-red-400'
    : 'border-slate-200 focus:border-kratos'

  if (!ready) {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? 'Address…'}
          className={`${baseInput} ${borderClass}`}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        value={inputVal}
        onChange={e => { setValue(e.target.value); onChange(e.target.value) }}
        placeholder={placeholder ?? 'Start typing an address…'}
        className={`${baseInput} ${borderClass}`}
        autoComplete="off"
      />
      {status === 'OK' && data.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {data.map(({ place_id, description, structured_formatting }) => (
            <li
              key={place_id}
              onMouseDown={e => { e.preventDefault(); handleSelect(description, place_id) }}
              className="cursor-pointer px-4 py-2.5 hover:bg-slate-50"
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
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
