export interface LaborDefaults {
  load_hours: number
  unload_hours: number
}

const STUDIO: LaborDefaults   = { load_hours: 1,   unload_hours: 1   }
const BED_1:  LaborDefaults   = { load_hours: 1.5, unload_hours: 1.5 }
const BED_2:  LaborDefaults   = { load_hours: 2.5, unload_hours: 2.5 }
const BED_3:  LaborDefaults   = { load_hours: 3.5, unload_hours: 3.5 }
const BED_4:  LaborDefaults   = { load_hours: 4.5, unload_hours: 4.5 }
const BED_5P: LaborDefaults   = { load_hours: 5.5, unload_hours: 5.5 }
const NONE:   LaborDefaults   = { load_hours: 0,   unload_hours: 0   }

const DEFAULTS: Record<string, LaborDefaults> = {
  // Studio
  studio:             STUDIO,
  studio_apartment:   STUDIO,
  // 1 Bedroom
  '1_bedroom':            BED_1,
  '1_bedroom_apartment':  BED_1,
  '1_bedroom_house':      BED_1,
  // 2 Bedroom
  '2_bedroom':            BED_2,
  '2_bedroom_apartment':  BED_2,
  '2_bedroom_house':      BED_2,
  // 3 Bedroom
  '3_bedroom':            BED_3,
  '3_bedroom_apartment':  BED_3,
  '3_bedroom_house':      BED_3,
  // 4 Bedroom
  '4_bedroom':            BED_4,
  '4_bedroom_apartment':  BED_4,
  '4_bedroom_house':      BED_4,
  // 5 Bedroom+
  '5_bedroom_plus':        BED_5P,
  '5_bedroom_house_plus':  BED_5P,
  // Partial / small — treat like studio
  partial: STUDIO,
}

/**
 * Returns default loading and unloading hours for a given move size.
 * Falls back to NONE (0h each) for offices, storage, and unknown sizes
 * so the minimum hours floor still applies.
 */
export function getDefaultLaborHours(moveSize: string | null | undefined): LaborDefaults {
  if (!moveSize) return NONE
  return DEFAULTS[moveSize] ?? NONE
}
