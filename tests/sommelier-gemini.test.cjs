const test=require('node:test'),assert=require('node:assert/strict')
const {load}=require('./helpers.cjs')
const ai=load('src/lib/server/ai.ts'),analysis=load('src/lib/server/sommelierAnalysis.ts')
const temperature=load('src/lib/servingTemperature.ts').servingTemperature
const records=Array.from({length:3},(_,i)=>({id:String(i),wine_name:['Champagne A','Cava B','Bordeaux C'][i],producer:null,vintage:'2021',score:null,stars:[4.5,3.8,2][i],wine_type:'sparkling',body:'medium',acidity:'high',tannin:'low',alcohol:'medium',country:'France',region:'Champagne',grape_variety:'Chardonnay'}))
const image={imageBase64:Buffer.from([255,216,255,0,0,0]).toString('base64'),imageMediaType:'image/jpeg',lang:'ja'}
const request=(body=image)=>new Request('http://localhost/api/sommelier',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
const identity={labelText:'Chablis Domaine Enclos 2022',vintage:'2022',observed:{wineName:'Chablis',producer:'Domaine Enclos',country:null,region:null,grapeVariety:null,wineType:'white'},knowledge:{confident:true,wineName:'Chablis',producer:'Domaine Enclos',country:'France',region:'Chablis',grapeVariety:'Chardonnay',wineType:'white'}}
const raw={identity,profile:{visual:'淡い黄色',nose:'レモン',body:'軽快',acidity:'強め',sweetness:'辛口',tannin:'ほぼなし',finish:'柑橘が続く',pairing:'白身魚のレモン焼きで酸味を楽しんでください。'},levels:{bodyLevel:2,acidityLevel:4,tanninLevel:1,alcoholLevel:2},comment:'Champagne Aの4.5点が参考になります。',referenceIds:['r1'],clarification:null}
function route({rows=records,quota=true,result=raw,finish='STOP',env={GEMINI_API_KEY:'offline',ANTHROPIC_API_KEY:'must-not-be-used'},dbError=null}={}){
 const calls=[],events=[]
 const query={select(){return this},eq(k,v){assert.equal(k,'user_id');assert.equal(v,'owner');return this},or(){return this},order(){return this},async limit(){return{data:rows,error:dbError}}}
 const mock={...ai,authorize:async()=>({verifiedUserId:'owner',from:n=>{assert.equal(n,'tastings');return query}}),reserveUsage:async()=>{events.push('reserve');if(!quota)throw new ai.ApiError('usage_limit',429)},providerFetch:async(url,init)=>{events.push('provider');calls.push({url,body:JSON.parse(init.body)});return{candidates:[{finishReason:finish,content:{parts:[{text:JSON.stringify(result)}]}}]}}}
 return{POST:load('src/app/api/sommelier/route.ts',{process:{env}},{'@/lib/server/ai':mock}).POST,calls,events}
}
test('Gemini sommelier uses one search-free call with server-owned positive and negative history',async()=>{
 const r=route();const response=await r.POST(request());assert.equal(response.status,200)
 const {result}=await response.json();assert.equal(result.producer,'Domaine Enclos');assert.equal(result.profile.nose,'レモン');assert.equal(result.servingTemperature,'7–10℃');assert.equal(result.priceJPY,null);assert.equal(result.blendRatio,null)
 assert.deepEqual(r.events,['reserve','provider']);assert.equal(r.calls.length,1);assert.ok(r.calls[0].url.includes('gemini-3.5-flash-lite'));assert.equal(r.calls[0].body.tools,undefined)
 const prompt=r.calls[0].body.contents[0].parts[0].text;assert.ok(prompt.includes('Bordeaux C'));assert.ok(prompt.includes('"rating":2'));assert.equal(result.historyReferences[0].wineName,'Champagne A')
})
test('Three rated records gate the provider, irrespective of wine types, and DB failure fails closed',async()=>{
 for(const [opts,status] of [[{rows:records.slice(0,2)},403],[{rows:records.map(r=>({...r,stars:null}))},403],[{dbError:new Error('offline')},503],[{quota:false},429],[{env:{ANTHROPIC_API_KEY:'offline'}},503]]){
  const r=route(opts);assert.equal((await r.POST(request())).status,status);assert.equal(r.calls.length,0)
 }
})
test('Sommelier never accepts user-supplied history instead of server records',async()=>{
 const r=route({rows:[]});assert.equal((await r.POST(request({...image,history:records}))).status,403);assert.equal(r.calls.length,0)
})
test('Manual identification works without an image; invalid years and empty inputs never reach provider',async()=>{
 const r=route();assert.equal((await r.POST(request({lang:'ja',wineName:'Chablis Domaine Enclos',vintage:'2022'}))).status,200);assert.equal(r.calls[0].body.contents[0].parts.length,1)
 for(const body of [{lang:'ja'},{lang:'ja',wineName:'Chablis',vintage:'20222'},{...image,imageBase64:'oops'}])assert.equal((await route().POST(request(body))).status,400)
})
test('Unknown product keeps identification help, but loses taste, personal memories and invented seconds',()=>{
 const h=analysis.historyContext(records)
 const unknown=analysis.readSommelierDetails({...raw,clarification:'生産者も教えてください。'},h,false)
 assert.equal(unknown.profile.nose,null);assert.equal(unknown.sommelierComment,null);assert.equal(unknown.historyReferences.length,0);assert.ok(unknown.clarification)
 const fabricated=analysis.readSommelierDetails({...raw,referenceIds:['made-up'],profile:{...raw.profile,finish:'6〜8秒'}},h,true)
 assert.equal(fabricated.sommelierComment,null);assert.equal(fabricated.profile.finish,null)
})
test('History samples include relative favourites and dislikes without identity or private notes',()=>{
 const h=analysis.historyContext(Array.from({length:100},(_,i)=>({...records[0],id:String(i),wine_name:'Wine '+i, stars:i===99?1:i===98?5:3,notes:'PRIVATE',user_id:'PRIVATE'})))
 assert.ok(h.some(r=>r.rating===1));assert.ok(h.some(r=>r.rating===5));assert.ok(h.length<=24);assert.ok(!JSON.stringify(h).includes('PRIVATE'))
})
test('Truncated and malformed Gemini responses fail rather than triggering a Claude fallback',async()=>{
 for(const opts of [{finish:'MAX_TOKENS'},{result:{identity:null}}]){const r=route(opts);assert.equal((await r.POST(request())).status,502);assert.equal(r.calls.length,1);assert.ok(r.calls[0].url.includes('googleapis.com'))}
})
test('Anthropic is blocked before any network request, including old unused helpers',async()=>{
 let calls=0;const guarded=load('src/lib/server/ai.ts',{fetch:async()=>{calls++}})
 await assert.rejects(guarded.providerFetch('https://api.anthropic.com/v1/messages',{}),e=>e.code==='provider_disabled');assert.equal(calls,0)
})
test('Serving temperature prioritises type and body over grape, and handles mixed blends conservatively',()=>{
 for(const [wine,expected] of [[{wineType:'sparkling',bodyLevel:5,grapeVariety:'Pinot Noir'},'6–10℃'],[{wineType:'white',bodyLevel:1,grapeVariety:'Chardonnay'},'7–10℃'],[{wineType:'white',bodyLevel:5},'10–13℃'],[{wineType:'red',grapeVariety:'ピノ・ノワール'},'12–14℃'],[{wineType:'red',grapeVariety:'Pinot Noir, Cabernet Sauvignon'},'15–18℃'],[{wineType:'red',bodyLevel:2,grapeVariety:'Syrah'},'12–14℃'],[{},null]])assert.equal(temperature(wine),expected)
})

test('Manual identities may know an unprinted winery, but must still match the actual typed product',async()=>{
 const input={lang:'ja',wineName:'Textbook Cabernet Sauvignon',vintage:'2022'}
 const resolved={...identity,knowledge:{...identity.knowledge,wineName:'Textbook Cabernet Sauvignon',producer:'Pey Family'}}
 const r=route({result:{...raw,identity:resolved}});const result=(await (await r.POST(request(input))).json()).result
 assert.equal(result.producer,'Pey Family');assert.equal(result.profile.nose,'レモン')
 const changed=route({result:{...raw,identity:{...identity,knowledge:{...identity.knowledge,wineName:'Unrelated Product'}}}})
 const rejected=(await (await changed.POST(request(input))).json()).result
 assert.equal(rejected.profile.nose,null);assert.equal(rejected.sommelierComment,null)
 const generic=route();assert.equal((await generic.POST(request({lang:'ja',wineName:'Chablis',vintage:'2022'}))).status,400);assert.equal(generic.calls.length,0)
})

test('Internal reference IDs stay out of the conversational prose',()=>{
 const result=analysis.readSommelierDetails({...raw,comment:'Champagne A（r1）の評価が参考になります。'},analysis.historyContext(records),true)
 assert.equal(result.sommelierComment,'Champagne Aの評価が参考になります。')
})
test('One comparable record is described as insufficient, not as uniform ratings',()=>{
 const taste=load('src/lib/tastePofile.ts')
 const profile=taste.calculateTasteProfile([records[0]])
 const result=taste.calculateMatchScore(profile,{body:3,tannin:1,acidity:5,alcohol:3})
 assert.equal(result.reason,'insufficient')
})
