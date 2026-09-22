import { knowledgeResult } from '@/lib/server/wineAnalysis'
import { findReviewedWine, type WineReading } from '@/lib/server/wineIdentity'

// Tasting is Gemini-only. Never silently call Anthropic or charge for a search.
// Knowledge suggestions are NOT inserted in the shared verified wine catalogue.
export async function resolveWine(reading: WineReading) {
  const reviewed = findReviewedWine(reading)
  if (reviewed) return reviewed
  const suggested = knowledgeResult(reading)
  if (suggested) return suggested
  // Even when identity is ambiguous, preserve genuinely printed country/grapes.
  // Do not turn a product-matching uncertainty into loss of all observed facts.
  return { ...reading, criticScores: [],
    wineResearch: { status: 'unverified' as const, source: null, catalogId: null, brand: reading.brand, background: reading.background },
    grapeResearch: { status: reading.grapeVariety ? 'label' as const : 'not_found' as const,
      source: null, vintageMatched: false, blendRatio: null },
  }
}
