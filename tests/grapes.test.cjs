const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const ai = load('src/lib/server/ai.ts')
const label = ai.validateLabel({ wineName: 'Reserve Margaux', producer: 'Mouton Cadet', vintage: '2022', country: 'France' })
const url = 'https://www.moutoncadet.com/fr/vins/reserve-mouton-cadet-margaux/'
const facts = { wineMatched: true, vintageMatched: true, grapeVariety: 'Cabernet Sauvignon, Merlot, Cabernet Franc', blendRatio: null, source: url }
function setup(factsOverride = facts, fail = false) {
 let calls = 0
 const providerFetch = async (_, init) => {
  calls++
  const body = JSON.parse(init.body)
  assert.equal(body.tools[0].max_uses, 2)
  assert.equal(body.max_tokens, 1600)
  if (fail) throw new ai.ApiError('provider_timeout', 502)
  return { stop_reason: 'end_turn', content: [{ type: 'web_search_tool_result', content: [{ type: 'web_search_result', url }] }, { type: 'text', text: JSON.stringify(factsOverride) }] }
 }
 return { enrich: load('src/lib/server/grapes.ts', {}, { '@/lib/server/ai': { ...ai, providerFetch } }).enrichGrapes, calls: () => calls }
}
test('Missing label varieties are researched and ratios may remain unknown', async () => {
 const s = setup(); const result = await s.enrich(label, 'ko', 'offline')
 assert.equal(result.grapeVariety, facts.grapeVariety)
 assert.equal(result.grapeResearch.status, 'verified')
 assert.equal(result.grapeResearch.blendRatio, null)
 assert.equal(result.grapeResearch.source, url)
 assert.equal(s.calls(), 1)
})
test('Other vintages cannot supply exact blend percentages', async () => {
 const result = await setup({ ...facts, vintageMatched: false, blendRatio: '60% Merlot, 40% Cabernet Sauvignon' }).enrich(label, 'ja', 'offline')
 assert.equal(result.grapeResearch.vintageMatched, false)
 assert.equal(result.grapeResearch.blendRatio, null)
 assert.equal(result.grapeVariety, facts.grapeVariety)
})
test('Unobserved source or different cuvee never fills grapes', async () => {
 for (const f of [{ ...facts, source: 'https://invented.example' }, { ...facts, wineMatched: false }]) {
  const result = await setup(f).enrich(label, 'ko', 'offline')
  assert.equal(result.grapeVariety, null)
  assert.equal(result.grapeResearch.status, 'not_found')
 }
})
test('Research failure preserves label identity and reports unavailability', async () => {
 const s = setup(facts, true); const result = await s.enrich(label, 'ko', 'offline')
 assert.equal(result.wineName, label.wineName)
 assert.equal(result.grapeResearch.status, 'unavailable')
 assert.equal(s.calls(), 1)
})
test('Visible varieties avoid additional calls and missing key is explicit', async () => {
 const s = setup()
 assert.equal((await s.enrich({ ...label, grapeVariety: 'Merlot' }, 'ko', 'offline')).grapeResearch.status, 'label')
 assert.equal((await s.enrich(label, 'ko')).grapeResearch.status, 'unavailable')
 assert.equal(s.calls(), 0)
})
test('Label route performs enrichment inside a single usage reservation', async () => {
 let reservations = 0, researches = 0
 const handler = load('src/app/api/label/route.ts', { process: { env: { GEMINI_API_KEY: 'offline', ANTHROPIC_API_KEY: 'offline' } } }, {
  '@/lib/server/ai': { ...ai, authorize: async () => ({}), readImage: async () => ({ lang: 'ko' }), reserveUsage: async () => { reservations++ }, providerFetch: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(label) }] } }] }) },
  '@/lib/server/grapes': { enrichGrapes: async (result, lang, key) => { researches++; assert.equal(lang,'ko'); assert.equal(key,'offline'); return { ...result, grapeVariety: facts.grapeVariety, grapeResearch: { status: 'verified' } } } },
 })
 const response = await handler.POST(new Request('http://localhost/api/label'))
 assert.equal(response.status, 200)
 assert.equal((await response.json()).result.grapeVariety, facts.grapeVariety)
 assert.equal(reservations, 1); assert.equal(researches, 1)
})
