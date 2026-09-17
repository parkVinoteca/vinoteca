import { createClient } from '@supabase/supabase-js'

export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code) }
}
export function failure(error: unknown) {
  const e = error instanceof ApiError ? error : new ApiError('temporarily_unavailable', 503)
  // Only stable internal codes: never log tokens, images, provider messages or user data.
  if (e.status >= 500) console.error('[ai_failure]', e.code)
  return Response.json({ error: e.code }, { status: e.status, headers: { 'Cache-Control': 'no-store', ...(e.status === 429 ? { 'Retry-After': '60' } : {}) } })
}
export async function authorize(req: Request) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) throw new ApiError('sign_in_required', 401)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new ApiError('temporarily_unavailable', 503)
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user || data.user.is_anonymous) throw new ApiError('sign_in_required', 401)
  return client
}
export async function readImage(req: Request) {
  if (!req.headers.get('content-type')?.includes('application/json')) throw new ApiError('invalid_image', 400)
  // Bound the stream itself: Content-Length is not trustworthy.
  const reader = req.body?.getReader()
  if (!reader) throw new ApiError('invalid_image', 400)
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 3_000_000) { await reader.cancel(); throw new ApiError('image_too_large', 413) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let body
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new ApiError('invalid_image', 400) }
  if (!body || typeof body !== 'object') throw new ApiError('invalid_image', 400)
  const { imageBase64, imageMediaType, lang } = body
  if (typeof imageBase64 !== 'string' || !imageBase64.length || imageBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) throw new ApiError('invalid_image', 400)
  const bytes = Buffer.from(imageBase64, 'base64')
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  if (!((imageMediaType === 'image/jpeg' && jpeg) || (imageMediaType === 'image/png' && png))) throw new ApiError('invalid_image', 400)
  if (lang !== 'ja' && lang !== 'ko') throw new ApiError('invalid_request', 400)
  return { imageBase64, imageMediaType, lang: lang as 'ja' | 'ko' }
}
export async function reserveUsage(client: Awaited<ReturnType<typeof authorize>>, feature: 'sommelier' | 'label_scan') {
  // Atomic DB reservation, BEFORE any billable call. No service-role key or client-side counters.
  const { data, error } = await client.rpc('reserve_ai_usage', { p_feature: feature })
  if (error) throw new ApiError('temporarily_unavailable', 503)
  if (data !== true) throw new ApiError('usage_limit', 429)
}
export async function providerFetch(url: string, init: RequestInit, timeoutMs = 40000) {
  const provider = url.includes('googleapis.com') ? 'gemini' : 'claude'
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(Math.min(60000, Math.max(1000, timeoutMs))), cache: 'no-store' })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      // Classify in memory; provider text may contain secrets, so never return or log it.
      const message = typeof body?.error?.message === 'string' ? body.error.message : ''
      let code = 'provider_request_failed'
      if (response.status === 401 || response.status === 403 || /API.key.not.valid|invalid.*api.key|API_KEY_INVALID/i.test(message)) code = 'provider_auth_failed'
      else if (response.status === 429) code = 'provider_busy'
      else if (/credit balance|billing|payment|insufficient.*credit/i.test(message) || response.status === 402) code = 'provider_billing'
      else if (response.status === 404) code = 'provider_model_unavailable'
      console.error('[ai_provider]', JSON.stringify({ provider, status: response.status, code }))
      throw new ApiError(code, 502)
    }
    return await response.json()
  } catch (error) {
    if (error instanceof ApiError) throw error
    const timeout = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
    throw new ApiError(timeout ? 'provider_timeout' : 'provider_unavailable', 502)
  }
}
export function parseResult(text: unknown) {
  if (typeof text !== 'string') throw new ApiError('invalid_ai_result', 502)
  // Models may explain a search before their final JSON. Extract a single balanced
  // object, respecting quoted braces and escapes; never greedily join two objects.
  const objects: string[] = []
  let start = -1, depth = 0, quoted = false, escaped = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (start < 0) { if (char === '{') { start = i; depth = 1 }; continue }
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) { objects.push(text.slice(start, i + 1)); start = -1 }
  }
  try {
    if (start >= 0 || objects.length !== 1) throw new Error()
    const result = JSON.parse(objects[0])
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error()
    return result as Record<string, unknown>
  } catch { console.error('[ai_result]', 'json_invalid'); throw new ApiError('invalid_ai_result', 502) }
}
function optionalText(value: unknown, max = 1500): string | null {
  if (value === undefined || value === null || value === '' || value === 'null') return null
  if (typeof value !== 'string' || value.length > max) { console.error('[ai_result]', 'invalid_text_field'); throw new ApiError('invalid_ai_result', 502) }
  return value
}
export function validateLabel(input: Record<string, unknown>) {
  const wineName = optionalText(input.wineName, 200)
  const producer = optionalText(input.producer, 200)
  if (!wineName && !producer) throw new ApiError('label_unreadable', 422)
  const vintage = input.vintage == null ? null : String(input.vintage)
  if (vintage && !/^(?:\d{4}|NV|N\/V)$/i.test(vintage)) throw new ApiError('invalid_ai_result', 502)
  const wineType = optionalText(input.wineType, 20)
  if (wineType && !['red','white','rose','sparkling','sweet'].includes(wineType)) throw new ApiError('invalid_ai_result', 502)
  return { wineName, producer, vintage, wineType,
    region: optionalText(input.region, 200), country: optionalText(input.country, 100), grapeVariety: optionalText(input.grapeVariety, 300) }
}
export function validateSommelier(input: Record<string, unknown>) {
  const label = validateLabel(input)
  const levels: Record<string, number | null> = {}
  for (const key of ['bodyLevel','tanninLevel','acidityLevel','alcoholLevel']) {
    const value = input[key]
    if (value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5)) throw new ApiError('invalid_ai_result', 502)
    levels[key] = typeof value === 'number' ? value : null
  }
  if (!Array.isArray(input.characteristics) || input.characteristics.length > 8 || input.characteristics.some(v => typeof v !== 'string' || v.length > 200)) throw new ApiError('invalid_ai_result', 502)
  return { ...label, ...levels, characteristics: input.characteristics,
    description: optionalText(input.description), blendRatio: optionalText(input.blendRatio), blendSource: optionalText(input.blendSource),
    priceJPY: optionalText(input.priceJPY, 100), priceJPYSource: optionalText(input.priceJPYSource), priceUSD: optionalText(input.priceUSD, 100), priceUSDSource: optionalText(input.priceUSDSource),
    expertScore: optionalText(input.expertScore, 200), recommendedFor: optionalText(input.recommendedFor) }
}
