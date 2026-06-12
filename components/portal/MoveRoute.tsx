'use client'

import { MapPin, Truck } from 'lucide-react'

interface Props {
  originAddress: string | null
  originCity: string | null
  originProvince: string | null
  destAddress: string | null
  destCity: string | null
  destProvince: string | null
}

function fmtAddr(
  address: string | null,
  city: string | null,
  province: string | null,
): { main: string; sub: string } {
  const cityProv = [city, province].filter(Boolean).join(', ')
  if (address) return { main: address, sub: cityProv }
  return { main: cityProv || 'To be confirmed', sub: '' }
}

export function MoveRoute({
  originAddress, originCity, originProvince,
  destAddress, destCity, destProvince,
}: Props) {
  const origin = fmtAddr(originAddress, originCity, originProvince)
  const dest   = fmtAddr(destAddress, destCity, destProvince)

  return (
    <div className="rounded-lg bg-white shadow-sm px-5 py-4">
      <div className="flex flex-col sm:flex-row sm:items-center">

        {/* Origin node */}
        <div className="flex items-start gap-3 sm:w-[38%]">
          <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-800" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Origin</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{origin.main}</p>
            {origin.sub && origin.main !== origin.sub && (
              <p className="text-xs text-slate-500">{origin.sub}</p>
            )}
          </div>
        </div>

        {/* Desktop connector — horizontal dashed line with centered truck */}
        <div className="hidden sm:flex flex-1 items-center justify-center px-3">
          <div className="relative w-full flex items-center h-5">
            <div className="w-full border-t-2 border-dashed border-kratos/40" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
              <Truck size={15} className="text-kratos" />
            </div>
          </div>
        </div>

        {/* Mobile connector — vertical with truck */}
        <div className="sm:hidden flex items-center gap-3 py-1.5 pl-[1px]">
          <div className="flex flex-col items-center w-5 gap-0.5">
            <div className="w-px h-3 bg-slate-200" />
            <Truck size={12} className="text-kratos" />
            <div className="w-px h-3 bg-slate-200" />
          </div>
        </div>

        {/* Destination node */}
        <div className="flex items-start gap-3 sm:w-[38%] sm:justify-end sm:flex-row-reverse">
          <MapPin size={15} className="mt-1 shrink-0 text-kratos" />
          <div className="min-w-0 sm:text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Destination</p>
            <p className="text-sm font-semibold text-slate-900 truncate">{dest.main}</p>
            {dest.sub && dest.main !== dest.sub && (
              <p className="text-xs text-slate-500">{dest.sub}</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
