// One explicitly tagged Preview build only. No user photos, raw errors or secrets
// are written to disk or logged. Ordinary CI/builds make no provider calls.
if (process.env.VERCEL_ENV !== 'preview' || !process.env.VERCEL_GIT_COMMIT_MESSAGE?.includes('[probe-gemini-search-20260921]')) process.exit(0)
const fs = require('node:fs')
const { load } = require('../tests/helpers.cjs')
const { providerFetch } = load('src/lib/server/ai.ts', { fetch: globalThis.fetch, process: { env: process.env } })
async function main() {
  const result = { model: 'gemini-2.5-flash', checkedAt: new Date().toISOString(), status: 'not_configured' }
  if (process.env.GEMINI_API_KEY) {
    const start = Date.now()
    try {
      const data = await providerFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST', headers: {'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
        body: JSON.stringify({contents:[{parts:[{text:'Use Google Search to identify the producer and grape varieties of Proyecto Cu4tro Cava Premium Reserva. Prefer Enoteca the Japanese importer. Return a short factual answer, no tasting notes, no guessed blend percentages.'}]}],tools:[{google_search:{}}],generationConfig:{maxOutputTokens:768,thinkingConfig:{thinkingBudget:0}}}),
      }, 40000)
      result.status = 'ok'
      result.seconds = (Date.now()-start)/1000
      result.usage = data.usageMetadata
      result.finishReason = data.candidates?.[0]?.finishReason
      result.searchSources = data.candidates?.[0]?.groundingMetadata?.groundingChunks?.filter(c=>c.web).map(c=>({title:c.web.title,uri:c.web.uri})) || []
      result.answer = data.candidates?.[0]?.content?.parts?.filter(p=>!p.thought).map(p=>p.text||'').join('')
    } catch(error) { result.status = error.code || 'failed'; result.seconds = (Date.now()-start)/1000 }
  }
  fs.writeFileSync('public/gemini-search-probe.json', JSON.stringify(result))
  console.log('[gemini_search_probe]', result.status)
}
main().catch(()=>{console.error('[gemini_search_probe] failed');process.exitCode=1})
