import { resolveWine } from '@/lib/server/wineLookup'
import { readWineAnalysis, wineAnalysisInstruction as instruction, wineAnalysisSchema as schema } from '@/lib/server/wineAnalysis'
import { ApiError, authorize, readImage, reserveUsage, providerFetch, parseResult, failure } from '@/lib/server/ai'
export const maxDuration = 180

async function gemini(image: Awaited<ReturnType<typeof readImage>>, key: string) {
  const data = await providerFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [ { text: instruction }, { inlineData: { mimeType: image.imageMediaType, data: image.imageBase64 } } ] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1600, responseJsonSchema: schema } }),
  }, 30000)
  const candidate = data.candidates?.[0]
  if (candidate?.finishReason !== 'STOP') throw new ApiError('analysis_failed', 502)
  return readWineAnalysis(parseResult(candidate.content?.parts?.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text || '').join('')))
}
// A warm server skips a recently unavailable Gemini provider; each request still has at most one fallback.
let geminiRetryAfter = 0
async function haiku(image: Awaited<ReturnType<typeof readImage>>, key: string) {
  const data = await providerFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1600, temperature: 0,
      messages: [{ role: 'user', content: [{ type: 'text', text: instruction + ' Return exactly one JSON object, without markdown.' },
        { type: 'image', source: { type: 'base64', media_type: image.imageMediaType, data: image.imageBase64 } }] }] }),
  }, 30000)
  if (data.stop_reason !== 'end_turn') throw new ApiError('analysis_failed', 502)
  return readWineAnalysis(parseResult(data.content?.filter((p: { type: string }) => p.type === 'text').map((p: { text: string }) => p.text).join('')))
}
export async function POST(req: Request) {
  try {
    const client = await authorize(req)
    const image = await readImage(req)
    const key = process.env.GEMINI_API_KEY, researchKey=process.env.ANTHROPIC_API_KEY
    if (!key && !researchKey) throw new ApiError('temporarily_unavailable', 503)
    await reserveUsage(client, 'label_scan')
    let result, provider: 'gemini' | 'claude' = 'gemini'
    if (key && Date.now() >= geminiRetryAfter) {
      try { result = await gemini(image,key) }
      catch (error) {
        if (!researchKey || !(error instanceof ApiError) || !error.code.startsWith('provider_')) throw error
        geminiRetryAfter = Date.now() + (['provider_busy','provider_billing'].includes(error.code) ? 300000 : 30000)
        console.warn('[ai_fallback]', 'label_scan_haiku', error.code)
      }
    }
    if (!result) {
      if (!researchKey) throw new ApiError('temporarily_unavailable',503)
      result = await haiku(image,researchKey); provider = 'claude'
    }
    const enriched = await resolveWine(result, researchKey)
    // Raw transcription is only needed on the server; it is not a verified fact.
    const publicResult = { ...enriched, labelText: undefined, knowledge: undefined }
    return Response.json({ result: publicResult, provider }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}
