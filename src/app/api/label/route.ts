import { resolveWine } from '@/lib/server/wineLookup'
import { displayJapaneseWine, japaneseDisplayInstruction } from '@/lib/server/wineDisplay'
import { readWineAnalysis, wineAnalysisInstruction as instruction, wineAnalysisSchema as schema } from '@/lib/server/wineAnalysis'
import { ApiError, authorize, readImage, reserveUsage, providerFetch, parseResult, failure } from '@/lib/server/ai'
export const maxDuration = 180

async function gemini(image: Awaited<ReturnType<typeof readImage>>, key: string) {
  const data = await providerFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [ { text: instruction + (image.lang === 'ja' ? japaneseDisplayInstruction : '') }, { inlineData: { mimeType: image.imageMediaType, data: image.imageBase64 } } ] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1600, thinkingConfig: { thinkingLevel: 'minimal' }, responseJsonSchema: schema } }),
  }, 60000)
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason !== 'STOP') throw new ApiError('analysis_failed', 502)
  return readWineAnalysis(parseResult(candidate.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')))
}
export async function POST(req: Request) {
  try {
    const client = await authorize(req)
    const image = await readImage(req)
    const key = process.env.GEMINI_API_KEY
    if (!key) throw new ApiError('temporarily_unavailable', 503)
    await reserveUsage(client, 'label_scan')
    const result = await gemini(image, key)
    const enriched = await resolveWine(result)
    // Raw transcription is only needed on the server; it is not a verified fact.
    const displayed = displayJapaneseWine(enriched, result.knowledge || result, result.japanese || {}, image.lang)
    const publicResult = { ...displayed, labelText: undefined, knowledge: undefined, japanese: undefined }
    return Response.json({ result: publicResult, provider: 'gemini' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
