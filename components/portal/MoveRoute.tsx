'use client'

interface Props {
  originAddress: string | null
  originCity: string | null
  originProvince: string | null
  destAddress: string | null
  destCity: string | null
  destProvince: string | null
}

function buildAddr(
  address: string | null,
  city: string | null,
  province: string | null,
): string | null {
  const parts = [address, city, province].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

export function MoveRoute({
  originAddress, originCity, originProvince,
  destAddress, destCity, destProvince,
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const origin = buildAddr(originAddress, originCity, originProvince)
  const dest   = buildAddr(destAddress, destCity, destProvince)

  if (!apiKey || !origin || !dest) return null

  const src =
    `https://www.google.com/maps/embed/v1/directions` +
    `?key=${apiKey}` +
    `&origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(dest)}` +
    `&mode=driving`

  return (
    <div className="rounded-xl overflow-hidden shadow-sm">
      <iframe
        title="Move route"
        src={src}
        width="100%"
        height="260"
        style={{ border: 0, display: 'block' }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  )
}
