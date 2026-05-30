/**
 * Labour time estimator for local moving jobs.
 *
 * Returns estimated load/unload/buffer hours by move size.
 * All values are estimates — agents can override in the charge panel.
 *
 * Extension point: these can be driven from a DB table later.
 */

export interface LaborTimeEstimate {
  loadHours: number
  unloadHours: number
  handlingBufferHours: number
  totalLabourHours: number
  requiresManualReview: boolean
  note: string | null
}

/**
 * Estimate labour time based on move size.
 * Returns null if move size is unrecognized (agent must enter manually).
 * Returns requiresManualReview=true for 5+ bedroom and office moves.
 */
export function estimateLabourTime(
  moveSize: string | null | undefined,
): LaborTimeEstimate | null {
  if (!moveSize) return null

  switch (moveSize) {
    // Studio
    case 'studio':
    case 'studio_apartment':
      return {
        loadHours: 0.75,
        unloadHours: 0.75,
        handlingBufferHours: 0.5,
        totalLabourHours: 2,
        requiresManualReview: false,
        note: null,
      }

    // 1 Bedroom (apartment or house)
    case '1_bedroom':
    case '1_bedroom_apartment':
    case '1_bedroom_house':
      return {
        loadHours: 1.25,
        unloadHours: 1.25,
        handlingBufferHours: 0.5,
        totalLabourHours: 3,
        requiresManualReview: false,
        note: null,
      }

    // 2 Bedroom Apartment
    case '2_bedroom':
    case '2_bedroom_apartment':
      return {
        loadHours: 2,
        unloadHours: 2,
        handlingBufferHours: 1,
        totalLabourHours: 5,
        requiresManualReview: false,
        note: null,
      }

    // 2 Bedroom House — slightly more
    case '2_bedroom_house':
      return {
        loadHours: 2.25,
        unloadHours: 2.25,
        handlingBufferHours: 1,
        totalLabourHours: 5.5,
        requiresManualReview: false,
        note: 'May extend to 6h with stairs, heavy furniture, or access difficulties.',
      }

    // 3 Bedroom
    case '3_bedroom':
    case '3_bedroom_apartment':
    case '3_bedroom_house':
      return {
        loadHours: 3,
        unloadHours: 3,
        handlingBufferHours: 1,
        totalLabourHours: 7,
        requiresManualReview: false,
        note: null,
      }

    // 4 Bedroom
    case '4_bedroom':
    case '4_bedroom_apartment':
    case '4_bedroom_house':
      return {
        loadHours: 3.75,
        unloadHours: 3.75,
        handlingBufferHours: 1.5,
        totalLabourHours: 9,
        requiresManualReview: false,
        note: 'Estimate: 8.5–9h. Confirm inventory before finalizing.',
      }

    // 5+ Bedroom — manual review
    case '5_bedroom_plus':
    case '5_bedroom_house_plus':
      return {
        loadHours: 0,
        unloadHours: 0,
        handlingBufferHours: 0,
        totalLabourHours: 0,
        requiresManualReview: true,
        note: '5+ bedrooms require manual review. Contact operations for a time estimate.',
      }

    // Office — manual review
    case 'office':
      return {
        loadHours: 0,
        unloadHours: 0,
        handlingBufferHours: 0,
        totalLabourHours: 0,
        requiresManualReview: true,
        note: 'Office moves require a manual time estimate. Confirm inventory and access.',
      }

    // Storage unit — small estimate
    case 'storage':
      return {
        loadHours: 1,
        unloadHours: 1,
        handlingBufferHours: 0.5,
        totalLabourHours: 2.5,
        requiresManualReview: false,
        note: 'Storage unit estimate. Adjust based on unit size and item count.',
      }

    default:
      return null
  }
}
