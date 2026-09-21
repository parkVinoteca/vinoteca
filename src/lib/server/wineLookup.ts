import { unstable_cache } from 'next/cache'
import { knowledgeResult } from '@/lib/server/wineAnalysis'
import { enrichGrapes } from '@/lib/server/grapes'
import { findReviewedWine, normalizeWineText, type WineReading } from '@/lib/server/wineIdentity'

// Only label transcription and printed vintage participate in the shared key.
// Do not cache images, account IDs, authorization or the API key. Language does
// not change source-language facts. Version changes invalidate old extraction.
export async function resolveWine(reading: WineReading, key?: string) {
  const reviewed = findReviewedWine(reading)
  if (reviewed) return reviewed
  const suggested = knowledgeResult(reading)
  if (suggested) return suggested
  const lookup = async () => enrichGrapes(reading, 'ja', key, false, reading)
  type Result = Awaited<ReturnType<typeof lookup>>
  let completed: Result | undefined
  const cached = unstable_cache(async () => {
    const result = await lookup()
    completed = result
    if (result.wineResearch?.status !== 'verified' || result.grapeResearch.status !== 'verified') {
      throw new Error('wine_lookup_not_cacheable')
    }
    return result
  }, ['wine-identity-v1', normalizeWineText(reading.labelText), reading.vintage || 'unknown'], { revalidate: 60 * 60 * 24 * 7 })
  try { return await cached() }
  catch {
    // An incomplete lookup is returned once, never frozen as shared wine data.
    // If the cache itself failed before invoking the lookup, use the same bounded path.
    return completed || await lookup()
  }
}
