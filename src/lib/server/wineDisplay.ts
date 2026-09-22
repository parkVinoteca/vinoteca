import { normalizeWineText, type Label } from '@/lib/server/wineIdentity'

export const japaneseFields = ['wineName', 'producer', 'country', 'region', 'grapeVariety'] as const
export type JapaneseWine = Partial<Record<typeof japaneseFields[number], string>>
export const japaneseDisplayInstruction = `Also return wineNameJa, producerJa, countryJa, regionJa and grapeVarietyJa as Japanese display strings or null. Use conventional Japanese wine-retail spelling: wine name in katakana without vintage, producer in katakana only (the app retains its original name), country/region in Japanese, grapes in katakana without adding percentages. Transliterate the SAME exact wine and all listed grapes, never substitute another cuvee. Prefer established Japanese names; use null if uncertain. Keep all original identity/evidence fields in the source language. Do this in the same response, without extra searches for translation.`

export function readJapaneseWine(raw: Record<string, unknown>): JapaneseWine {
  const result: JapaneseWine = {}
  for (const field of japaneseFields) {
    const value = raw[`${field}Ja`]
    if (typeof value === 'string' && value.trim() && value.length <= 300 && /[\u3040-\u30ff\u3400-\u9fff]/.test(value) && !/[<>\n\r]/.test(value)) result[field] = ['wineName', 'producer', 'grapeVariety'].includes(field)
      ? value.trim().replace(/(?<=[\p{Script=Katakana}ー])[\s・･]+(?=[\p{Script=Katakana}ー])/gu, '・')
      : value.trim()
  }
  return result
}

// Translate only the same original fact. A later identity correction must not
// inherit a Japanese name generated for an earlier, different guess.
export function displayJapaneseWine<T extends Label>(result: T, original: Label, japanese: JapaneseWine, lang: string): T {
  if (lang !== 'ja') return result
  const displayed = { ...result }
  for (const field of japaneseFields) {
    if (!result[field] || !original[field] || normalizeWineText(result[field]!) !== normalizeWineText(original[field]!)) continue
    const translated = japanese[field]
    if (translated) displayed[field] = field === 'producer' ? `${result[field]} / ${translated}` : translated
  }
  return displayed
}
