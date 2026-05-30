export interface PortalMaterial {
  id: string
  name: string
  description: string
  unitPrice: number
}

export const PORTAL_MATERIALS: PortalMaterial[] = [
  { id: 'small_box',     name: 'Small Moving Box',   description: '1.5 cu ft — books, fragile items',         unitPrice: 2.99 },
  { id: 'medium_box',    name: 'Medium Moving Box',  description: '3.0 cu ft — kitchen, toys, clothes',       unitPrice: 3.99 },
  { id: 'large_box',     name: 'Large Moving Box',   description: '4.5 cu ft — linens, pillows, lamps',       unitPrice: 4.99 },
  { id: 'xl_box',        name: 'XL Moving Box',      description: '6.0 cu ft — light bulky items',            unitPrice: 5.99 },
  { id: 'wardrobe_box',  name: 'Wardrobe Box',       description: 'Hang clothes directly from closet',         unitPrice: 14.99 },
  { id: 'tape',          name: 'Packing Tape',        description: '2-inch roll, 60 m — sealing boxes',        unitPrice: 2.99 },
  { id: 'packing_paper', name: 'Packing Paper',       description: '10 lbs — wrapping dishes and fragile items', unitPrice: 12.99 },
  { id: 'bubble_wrap',   name: 'Bubble Wrap',         description: '12" × 30 ft — electronics and fragile items', unitPrice: 9.99 },
  { id: 'mattress_bag',  name: 'Mattress Bag',        description: 'Queen/Full size — protects from dust and tears', unitPrice: 7.99 },
  { id: 'tv_box',        name: 'TV Box',              description: 'Up to 65" flat screen — telescoping box',  unitPrice: 19.99 },
]
