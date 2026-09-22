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
test('Provider errors do not leak upstream response details', async () => {
  const isolated = load('src/lib/server/ai.ts', { fetch: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'sensitive provider details' } }) }) })
  try { await isolated.providerFetch('https://example.com', {}) } catch (e) { assert.equal(await isolated.failure(e).text(), '{"error":"provider_auth_failed"}') }
})

test('Provider failures distinguish credentials, credit, quota and model without exposing details', async () => {
  for (const [status, message, code] of [[400,'API key not valid. SECRET','provider_auth_failed'],[400,'Your credit balance is too low. SECRET','provider_billing'],[429,'Quota exceeded. Check plan and billing details. SECRET','provider_busy'],[404,'SECRET','provider_model_unavailable']]) {
    const logs=[]
    const isolated=load('src/lib/server/ai.ts', {console: {error: (...args)=>logs.push(args.join(' '))},fetch:async()=>({ok:false,status,json:async()=>({error:{message}})})})
    await assert.rejects(isolated.providerFetch('https://generativelanguage.googleapis.com/v1beta/models/test:generateContent',{}),e=>e.code===code)
    assert.equal(logs.join('').includes('SECRET'),false)
    assert.ok(logs.join('').includes(code))
  }
})

test('Final JSON tolerates narration and fenced output but rejects ambiguity and truncation',()=>{
 assert.equal(ai.parseResult('Search complete.\n```json\n'+JSON.stringify(valid)+'\n```').wineName,valid.wineName)
 assert.equal(ai.parseResult('{"wineName":"Braces {quoted} and \\"escape\\""}').wineName,'Braces {quoted} and "escape"')
 for(const text of ['{} {}','{"wineName":"cut off"','[]'])assert.throws(()=>ai.parseResult(text))
})

test('Label scan uses a bounded extraction model and validates the structured response',async()=>{
 let captured
 const mocked={...ai,authorize:async()=>({}),reserveUsage:async()=>{},providerFetch:async(url,init)=>{captured={url,body:JSON.parse(init.body)};return{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({labelText:'Chateau Margaux 2015',wineName:'Chateau Margaux',producer:'Chateau Margaux',vintage:'2015',wineType:'red'})}]}}]}}}
 const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline-test'}}},{'@/lib/server/ai':mocked})
 const response=await handler.POST(request(image))
 assert.equal(response.status,200);assert.equal((await response.json()).result.vintage,'2015')
 assert.ok(captured.url.includes('gemini-3.5-flash-lite'))
 assert.equal(captured.body.generationConfig.responseJsonSchema.additionalProperties,false)
 assert.equal(captured.body.generationConfig.maxOutputTokens,1600)
})


test('Unreadable labels do not trigger a paid retry',async()=>{
 for(const code of ['label_unreadable','invalid_ai_result','analysis_failed']){
  let calls=0
  const mock={...ai,authorize:async()=>({}),reserveUsage:async()=>{},providerFetch:async()=>{calls++;throw new ai.ApiError(code,502)}}
  const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline',ANTHROPIC_API_KEY:'offline'}}},{'@/lib/server/ai':mock})
  assert.equal((await handler.POST(request(image))).status,502);assert.equal(calls,1)
 }
})




test('Gemini errors never invoke Anthropic, even when its key is configured',async()=>{
 for(const code of ['provider_busy','provider_billing','provider_timeout','provider_unavailable','provider_auth_failed','provider_model_unavailable']){
  const calls=[];let reservations=0
  const mock={...ai,authorize:async()=>({}),reserveUsage:async()=>{reservations++},providerFetch:async(url)=>{calls.push(url);throw new ai.ApiError(code,502)}}
  const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'offline',ANTHROPIC_API_KEY:'offline'}}},{'@/lib/server/ai':mock})
  const r=await handler.POST(request(image));assert.equal(r.status,502)
  assert.equal((await r.json()).error,code);assert.equal(calls.length,1);assert.equal(reservations,1)
  assert.ok(calls[0].includes('googleapis.com'))
 }
})
test('Missing Gemini key fails before quota reservation and never uses a configured Claude key',async()=>{
 let calls=0,reservations=0
 const mock={...ai,authorize:async()=>({}),reserveUsage:async()=>{reservations++},providerFetch:async()=>{calls++}}
 const handler=load('src/app/api/label/route.ts',{process:{env:{ANTHROPIC_API_KEY:'offline'}}},{'@/lib/server/ai':mock})
 assert.equal((await handler.POST(request(image))).status,503);assert.equal(calls,0);assert.equal(reservations,0)
})

test('Provider citation markup is not shown as wine description text',()=>{
 const result=ai.validateSommelier({...valid,description:'<cite index="1-1">Wine description</cite>'})
 assert.equal(result.description,'Wine description')
})



test('Latency diagnostics distinguish waiting for headers from a stalled response body without leaking data',async()=>{
 for(const stage of ['waiting_headers','reading_body']){
  const logs=[]
  const timeout=Object.assign(new Error('SECRET upstream details'),{name:'TimeoutError'})
  const isolated=load('src/lib/server/ai.ts',{Error,console:{warn:(...args)=>logs.push(args.join(' '))},fetch:async()=>{
   if(stage==='waiting_headers')throw timeout
   return {ok:true,json:async()=>{throw timeout}}
  }})
  await assert.rejects(isolated.providerFetch('https://generativelanguage.googleapis.com/v1beta/models/test:generateContent',{}),e=>e.code==='provider_timeout')
  assert.ok(logs[0].includes(stage));assert.ok(!logs[0].includes('SECRET'))
 }
})
