const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const ai = load('src/lib/server/ai.ts')
const image = { imageBase64: Buffer.from([255,216,255,0,0,0]).toString('base64'), imageMediaType: 'image/jpeg', lang: 'ja' }
const request = body => new Request('http://localhost/api/sommelier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const valid = { wineName: 'Example wine', producer: 'Example producer', vintage: '2020', wineType: 'red', bodyLevel: 3, tanninLevel: 2, acidityLevel: 4, alcoholLevel: 3, characteristics: ['Dry'], priceJPY: 'JPY 3000', priceJPYSource: 'https://example.com/wine', blendRatio: '100% Merlot', blendSource: 'https://invented.example/wine' }
test('Unauthenticated requests are rejected by both AI endpoints', async () => {
  for (const endpoint of ['sommelier','label']) assert.equal((await load(`src/app/api/${endpoint}/route.ts`).POST(request(image))).status, 401)
})
test('Image validation rejects malformed, spoofed and invalid-language requests', async () => {
  for (const body of [{}, { ...image, imageBase64: 'not-base64' }, { ...image, imageMediaType: 'image/png' }, { ...image, lang: 'en' }]) await assert.rejects(ai.readImage(request(body)), e => e.status === 400)
  assert.equal((await ai.readImage(request(image))).imageMediaType, 'image/jpeg')
})
test('Image stream limit is enforced independently of Content-Length', async () => {
  await assert.rejects(ai.readImage(request({ ...image, imageBase64: 'A'.repeat(3_000_001) })), e => e.status === 413)
})
test('AI results require an identifiable label and bounded correctly typed fields', () => {
  for (const value of [{}, { ...valid, bodyLevel: 999 }, { ...valid, characteristics: 42 }, { ...valid, vintage: 'last year' }]) assert.throws(() => ai.validateSommelier(value))
  assert.equal(ai.validateSommelier(valid).wineName, 'Example wine')
})
test('Quota store failure fails closed, and rejection never looks like success', async () => {
  await assert.rejects(ai.reserveUsage({ rpc: async () => ({ error: new Error('DB offline') }) }, 'sommelier'), e => e.status === 503)
  await assert.rejects(ai.reserveUsage({ rpc: async () => ({ data: false }) }, 'sommelier'), e => e.status === 429)
})
function route(data, extra = {}) {
  let calls = 0, reservations = 0
  const mock = { ...ai, authorize: async () => ({}), reserveUsage: async () => { reservations++ }, providerFetch: async () => { calls++; return data }, ...extra }
  return { POST: load('src/app/api/sommelier/route.ts', { process: { env: { ANTHROPIC_API_KEY: 'offline-test-placeholder' } } }, { '@/lib/server/ai': mock }).POST, counts: () => ({ calls, reservations }) }
}
const responseData = (result = valid, stop_reason = 'end_turn') => ({ stop_reason, content: [ { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://example.com/wine', title: 'Example' }] }, { type: 'text', text: JSON.stringify(result) } ] })
test('Sommelier reserves before provider call and removes unsupported source claims', async () => {
  const handler = route(responseData())
  const response = await handler.POST(request(image))
  const { result } = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.priceJPY, 'JPY 3000')
  assert.equal(result.blendRatio, null)
  assert.deepEqual(handler.counts(), { reservations: 1, calls: 1 })
})
test('Sommelier rejects invalid AI results, truncation and missing search evidence', async () => {
  for (const data of [responseData({ ...valid, bodyLevel: 999 }), responseData(valid, 'max_tokens'), { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(valid) }] }]) assert.equal((await route(data).POST(request(image))).status, 502)
})
test('Rate rejection prevents any paid provider call', async () => {
  const handler = route(responseData(), { reserveUsage: async () => { throw new ai.ApiError('usage_limit', 429) } })
  assert.equal((await handler.POST(request(image))).status, 429)
  assert.equal(handler.counts().calls, 0)
})
test('Provider errors do not leak upstream response details', async () => {
  const isolated = load('src/lib/server/ai.ts', { fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'sensitive provider details' } }) }) })
  try { await isolated.providerFetch('https://example.com', {}) } catch (e) { assert.equal(await isolated.failure(e).text(), '{"error":"provider_auth_failed"}') }
})

test('Provider failures distinguish credentials, credit, quota and model without exposing details', async () => {
  for (const [status, message, code] of [[400,'API key not valid. SECRET','provider_auth_failed'],[400,'Your credit balance is too low. SECRET','provider_billing'],[429,'Quota exceeded. Check plan and billing details. SECRET','provider_busy'],[404,'SECRET','provider_model_unavailable']]) {
    const logs=[]
    const isolated=load('src/lib/server/ai.ts', {console: {error: (...args)=>logs.push(args.join(' '))},fetch:async()=>({ok:false,status,json:async()=>({error:{message}})})})
    await assert.rejects(isolated.providerFetch('https://api.anthropic.com/v1/messages',{}),e=>e.code===code)
    assert.equal(logs.join('').includes('SECRET'),false)
    assert.ok(logs.join('').includes(code))
  }
})

test('Final JSON tolerates narration and fenced output but rejects ambiguity and truncation',()=>{
 assert.equal(ai.parseResult('Search complete.\n```json\n'+JSON.stringify(valid)+'\n```').wineName,valid.wineName)
 assert.equal(ai.parseResult('{"wineName":"Braces {quoted} and \\"escape\\""}').wineName,'Braces {quoted} and "escape"')
 for(const text of ['{} {}','{"wineName":"cut off"','[]'])assert.throws(()=>ai.parseResult(text))
})
test('Sommelier parses the final response after a separate search narration block',async()=>{
 const data=responseData();data.content.unshift({type:'text',text:'I will check the producer and Japanese retailers.'})
 assert.equal((await route(data).POST(request(image))).status,200)
})
test('Label scan uses a bounded extraction model and validates the structured response',async()=>{
 let captured
 const mocked={...ai,authorize:async()=>({}),reserveUsage:async()=>{},providerFetch:async(url,init)=>{captured={url,body:JSON.parse(init.body)};return{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({wineName:'Chateau Margaux',producer:'Chateau Margaux',vintage:'2015',wineType:'red'})}]}}]}}}
 const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline-test'}}},{'@/lib/server/ai':mocked})
 const response=await handler.POST(request(image))
 assert.equal(response.status,200);assert.equal((await response.json()).result.vintage,'2015')
 assert.ok(captured.url.includes('gemini-3.5-flash-lite'))
 assert.equal(captured.body.generationConfig.responseJsonSchema.additionalProperties,false)
 assert.equal(captured.body.generationConfig.maxOutputTokens,2048)
})
