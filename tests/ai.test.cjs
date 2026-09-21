const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const ai = load('src/lib/server/ai.ts')
const image = { imageBase64: Buffer.from([255,216,255,0,0,0]).toString('base64'), imageMediaType: 'image/jpeg', lang: 'ja' }
const request = body => new Request('http://localhost/api/sommelier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const valid = { wineName: 'Example wine', producer: 'Example producer', vintage: '2020', wineType: 'red', bodyLevel: 3, tanninLevel: 2, acidityLevel: 4, alcoholLevel: 3, characteristics: ['Dry'], priceJPY: 'JPY 3000', priceJPYSource: 'https://example.com/wine', blendRatio: '100% Merlot', blendSource: 'https://invented.example/wine', sommelierComment: 'A lively wine with a refreshing style.', sommelierCommentSource: 'https://invented.example/wine' }
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
  assert.equal(result.sommelierComment, null)
  assert.equal(result.sommelierCommentSource, null)
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
 const mocked={...ai,authorize:async()=>({}),reserveUsage:async()=>{},providerFetch:async(url,init)=>{captured={url,body:JSON.parse(init.body)};return{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({labelText:'Chateau Margaux 2015',wineName:'Chateau Margaux',producer:'Chateau Margaux',vintage:'2015',wineType:'red'})}]}}]}}}
 const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline-test'}}},{'@/lib/server/ai':mocked})
 const response=await handler.POST(request(image))
 assert.equal(response.status,200);assert.equal((await response.json()).result.vintage,'2015')
 assert.ok(captured.url.includes('gemini-3.5-flash-lite'))
 assert.equal(captured.body.generationConfig.responseJsonSchema.additionalProperties,false)
 assert.equal(captured.body.generationConfig.maxOutputTokens,1024)
})

test('Citation-segmented text is reassembled without inserting newlines inside JSON strings',async()=>{
 const json=JSON.stringify({...valid,description:'Producer details and quoted source'})
 const split=json.indexOf('Producer details')+8
 const data=responseData()
 data.content.splice(1,1,{type:'text',text:'Research complete. '+json.slice(0,split),citations:[{type:'web_search_result_location'}]},{type:'text',text:json.slice(split)})
 const response=await route(data).POST(request(image));assert.equal(response.status,200)
 assert.equal((await response.json()).result.description,'Producer details and quoted source')
})
test('Unreadable labels do not trigger a paid retry',async()=>{
 for(const code of ['label_unreadable','invalid_ai_result','analysis_failed']){
  let calls=0
  const mock={...ai,authorize:async()=>({}),reserveUsage:async()=>{},providerFetch:async()=>{calls++;throw new ai.ApiError(code,502)}}
  const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline',ANTHROPIC_API_KEY:'offline'}}},{'@/lib/server/ai':mock})
  assert.equal((await handler.POST(request(image))).status,502);assert.equal(calls,1)
 }
})
test('Sommelier conversation is accepted only with an observed source and stays within the existing call',async()=>{
 const data=responseData({...valid,sommelierComment:'果実味が魅力の一本ですね。',sommelierCommentSource:'https://example.com/wine'})
 const response=await route(data).POST(request(image))
 const {result}=await response.json()
 assert.equal(result.sommelierCommentSource,'https://example.com/wine')
 assert.equal(result.sommelierComment,'果実味が魅力の一本ですね。')
 assert.equal(result.drinkingWindow,undefined)
})

test('Sommelier uses bounded Haiku searches and bounded evidence fetching without premium retry',async()=>{
 let calls=0
 const handler=route(responseData(),{providerFetch:async(url,init)=>{
  calls++;const body=JSON.parse(init.body)
  assert.equal(body.model,'claude-haiku-4-5-20251001')
  assert.equal(body.tools.length,2);assert.equal(body.tools[0].max_uses,2)
  assert.equal(body.max_tokens,2400)
  return responseData()
 }})
 assert.equal((await handler.POST(request(image))).status,200);assert.equal(calls,1)
})

test('Gemini outage uses Haiku once and a warm server skips the exhausted provider',async()=>{
 for(const code of ['provider_busy','provider_billing','provider_timeout','provider_unavailable','provider_auth_failed','provider_model_unavailable']){
  const calls=[];let reservations=0
  const mock={...ai,authorize:async()=>({}),reserveUsage:async()=>{reservations++},providerFetch:async(url,init)=>{
   const body=JSON.parse(init.body);calls.push({url,body})
   if(url.includes('googleapis'))throw new ai.ApiError(code,502)
   return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({labelText:'Test Merlot',wineName:'Test',grapeVariety:'Merlot'})}]}
  }}
  const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline',ANTHROPIC_API_KEY:'offline'}}},{'@/lib/server/ai':mock,'@/lib/server/wineLookup':{resolveWine:async r=>r}})
  for(let i=0;i<2;i++){const r=await handler.POST(request(image));assert.equal(r.status,200);assert.equal((await r.json()).provider,'claude')}
  assert.equal(calls.length,3);assert.equal(reservations,2)
  for(const c of calls.slice(1)){assert.equal(c.body.model,'claude-haiku-4-5-20251001');assert.equal(c.body.tools,undefined);assert.equal(c.body.max_tokens,1024)}
 }
})
test('Missing Gemini key can still use Haiku and double outages fail without looping',async()=>{
 for(const failed of [false,true]){
  let calls=0
  const mock={...ai,authorize:async()=>({}),reserveUsage:async()=>{},providerFetch:async()=>{calls++;if(failed)throw new ai.ApiError('provider_busy',502);return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({labelText:'Test Merlot',wineName:'Test',grapeVariety:'Merlot'})}]}}}
  const handler=load('src/app/api/label/route.ts',{process:{env:{ANTHROPIC_API_KEY:'offline'}}},{'@/lib/server/ai':mock,'@/lib/server/wineLookup':{resolveWine:async r=>r}})
  assert.equal((await handler.POST(request(image))).status,failed?502:200);assert.equal(calls,1)
 }
})

test('Provider citation markup is not shown as wine description text',()=>{
 const result=ai.validateSommelier({...valid,description:'<cite index="1-1">Wine description</cite>'})
 assert.equal(result.description,'Wine description')
})

test('Sommelier grapes and blend require fetched evidence, never fermentation percentages',async()=>{
 const source='https://example.com/wine',doc='Example wine Example producer 2020. Varieties: Merlot. Blend: 100% Merlot. Fermentation: 95% stainless steel, 5% oak.'
 for(const [blend,expected] of [['100% Merlot','100% Merlot'],['95% stainless steel, 5% oak',null]]){
  const data=responseData({...valid,grapeVariety:'Merlot',grapeSource:source,grapeEvidence:'Varieties: Merlot.',blendRatio:blend,blendSource:source})
  data.content.push({type:'web_fetch_tool_result',content:{url:source,content:{source:{type:'text',data:doc}}}})
  const result=(await (await route(data).POST(request(image))).json()).result
  assert.equal(result.grapeVariety,'Merlot');assert.equal(result.blendRatio,expected)
 }
 const r=(await (await route(responseData({...valid,grapeVariety:'Invented grape'})).POST(request(image))).json()).result
 assert.equal(r.grapeVariety,null)
})
