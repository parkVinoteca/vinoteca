const fs = require('node:fs')
async function main() {
  if (process.env.VERCEL_ENV !== 'preview' || !process.env.VERCEL_GIT_COMMIT_MESSAGE?.includes('[probe-free-project-20260921]')) return
  const key = process.env.GEMINI_API_KEY
  const results = []
  for (const model of ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']) {
    for (const search of [false, true]) {
      const started = Date.now()
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key || '' },
          body: JSON.stringify({ contents: [{ parts: [{ text: search ? 'Find the producer and grape varieties of Proyecto Cu4tro Cava Premium Reserva. Use a producer or official importer source. Do not invent vintage-specific percentages. Answer concisely.' : 'Reply OK.' }] }], ...(search ? { tools: [{ google_search: {} }] } : {}), generationConfig: { maxOutputTokens: search ? 1200 : 32 } }),
          signal: AbortSignal.timeout(45000),
        })
        const data = await response.json()
        const candidate = data.candidates?.[0]
        results.push({ model, search, status: response.status, apiStatus: data.error?.status || null, elapsedMs: Date.now() - started, usage: data.usageMetadata || null, answer: response.ok ? candidate?.content?.parts?.filter(p => !p.thought).map(p => p.text || '').join('') : null, finishReason: candidate?.finishReason || null, sourceCount: candidate?.groundingMetadata?.groundingChunks?.length || 0 })
      } catch { results.push({ model, search, status: 'transport_failed', elapsedMs: Date.now() - started }) }
    }
  }
  fs.writeFileSync('public/free-project-probe.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }))
}
main().catch(() => { process.exitCode = 1 })
