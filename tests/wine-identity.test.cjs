const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const identity = load('src/lib/server/wineIdentity.ts')
const labelText = 'PROYECTO CU4TRO Bubbles Premium Reserva Guarda Superior 2021 CAVA COMTATS DE BARCELONA'
const reading = identity.readWineLabel({labelText,wineName:'CU4TRO Bubbles Premium Reserva',producer:'CU4TRO',region:'Guarda Superior',country:'Spain',vintage:'2021'})

test('Reported bottle role mistakes are not promoted to producer and region',()=>{
 assert.equal(reading.producer,null);assert.equal(reading.region,null);assert.equal(reading.country,null)
 assert.equal(reading.vintage,'2021')
 assert.equal(identity.readWineLabel({labelText:'Example 2021',wineName:'Example',vintage:'2022'}).vintage,null)
 assert.throws(()=>identity.readWineLabel({wineName:'Example'}))
})
test('Two reported role assignments and harmless OCR spacing resolve to the same reviewed cuvee',()=>{
 const results=[
  {...reading,wineName:'CUZ4TRO',producer:'Proyecto',region:'Guarda Superior'},
  {...reading,wineName:'CU4TRO Bubbles Premium Reserva',producer:'CU4TRO',region:'Penedès'},
  {...reading,labelText:labelText.replace('CU4TRO','Cu 4 tro').replaceAll(' ','\n')},
 ].map(identity.findReviewedWine)
 for(const result of results){
  assert.equal(result.producer,'Clos Montblanc');assert.equal(result.wineName,'Proyecto Cu4tro Cava Premium Reserva')
  assert.equal(result.country,'Spain');assert.equal(result.region,'Catalunya');assert.equal(result.wineType,'sparkling')
  assert.equal(result.grapeVariety,'Macabeo, Xarel·lo, Parellada, Chardonnay')
  assert.equal(result.vintage,'2021');assert.equal(result.grapeResearch.blendRatio,null)
  assert.equal(result.grapeResearch.vintageMatched,false)
 }
 assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2])
})
test('Regular cava, rose, other brands and insufficient crops do not inherit Premium Reserva facts',()=>{
 for(const text of ['PROYECTO CU4TRO CAVA','CU4TRO Premium Reserva Rose Cava','CU4TRO SOLES Premium Reserva Bubbles','Premium Reserva 2021','CU4TRO Premium'])
  assert.equal(identity.findReviewedWine({...reading,labelText:text}),null)
 assert.equal(identity.findReviewedWine({...reading,vintage:'2022'}).vintage,'2022')
})
const doc='Domaine Rivage. Rivage Reserve. France, Loire. Cabernet Franc. 2021.'
const observed=identity.readWineLabel({labelText:'Domaine Rivage Rivage Reserve 2021',wineName:'Rivage Reserve',vintage:'2021'})
const evidence={wineMatched:true,identity:{wineName:'Rivage Reserve',producer:'Domaine Rivage',country:'France',region:'Loire',wineType:'red'},identityEvidence:doc}
test('General identity correction requires a matching product passage, not a guessed source URL',()=>{
 assert.equal(identity.verifyWineIdentity(evidence,doc,observed).producer,'Domaine Rivage')
 for(const altered of [{...evidence,identityEvidence:'Invented text'}, {...evidence,wineMatched:false}, {...evidence,identity:{...evidence.identity,producer:'Wrong Winery'}}])
  assert.equal(identity.verifyWineIdentity(altered,doc,observed),null)
 assert.equal(identity.verifyWineIdentity(evidence,doc,{...observed,labelText:'Otherwine Premium Reserva 2021'}),null)
})
test('Unresolved identities leave producer and geography blank and expose review status',()=>{
 const r=identity.unverifiedWine({...reading,producer:'Proyecto',region:'Guarda Superior',country:'Spain'})
 assert.equal(r.wineResearch.status,'unverified');assert.equal(r.producer,null);assert.equal(r.region,null);assert.equal(r.country,null)
})
test('Country and region may use separate quotes from the same fetched document',()=>{
 const split={...evidence,identityEvidence:'Domaine Rivage. Rivage Reserve.',countryEvidence:'France, Loire.',regionEvidence:'France, Loire.'}
 const result=identity.verifyWineIdentity(split,doc,observed)
 assert.equal(result.country,'France');assert.equal(result.region,'Loire')
 const wrong=identity.verifyWineIdentity({...split,countryEvidence:'Spain',identity:{...split.identity,country:'Spain'}},doc,observed)
 assert.equal(wrong.country,null)
})
test('Reviewed cuvee avoids research and credentials entirely',async()=>{
 const resolver=load('src/lib/server/wineLookup.ts',{}, {'next/cache':{unstable_cache:()=>{throw new Error('should not cache curated facts')}},'@/lib/server/grapes':{enrichGrapes:()=>{throw new Error('should not research curated facts')}}})
 assert.equal((await resolver.resolveWine(reading)).wineResearch.status,'catalog')
})
test('Shared cache reuses verified facts across credentials but never caches incomplete lookup',async()=>{
 let calls=0, verified=true
 const cache=new Map()
 const resolver=load('src/lib/server/wineLookup.ts',{}, {
  'next/cache':{unstable_cache:(fn,key)=>async()=>{const k=JSON.stringify(key);if(cache.has(k))return cache.get(k);const r=await fn();cache.set(k,r);return r}},
  '@/lib/server/grapes':{enrichGrapes:async()=>{calls++;return {wineResearch:{status:verified?'verified':'unavailable'},grapeResearch:{status:verified?'verified':'unavailable'}}}},
 })
 await resolver.resolveWine(observed,'keyA');await resolver.resolveWine(observed,'keyB');assert.equal(calls,1)
 verified=false
 for(let i=0;i<2;i++)await resolver.resolveWine({...observed,vintage:'2022'})
 assert.equal(calls,3)
 assert.equal([...cache.keys()].some(k=>k.includes('keyA')||k.includes('keyB')),false)
})
test('Cache write failure after research does not issue a second paid research request',async()=>{
 let calls=0
 const resolver=load('src/lib/server/wineLookup.ts',{}, {
  'next/cache':{unstable_cache:fn=>async()=>{await fn();throw new Error('cache write failure')}},
  '@/lib/server/grapes':{enrichGrapes:async()=>{calls++;return {wineResearch:{status:'verified'},grapeResearch:{status:'verified'}}}},
 })
 await resolver.resolveWine(observed,'key');assert.equal(calls,1)
})
test('General research corrects all identity roles even when OCR already read a grape',async()=>{
 const ai=load('src/lib/server/ai.ts')
 const url='https://winery.example/rivage-reserve'
 let calls=0
 const enrich=load('src/lib/server/grapes.ts',{}, {'@/lib/server/ai':{...ai,providerFetch:async(_,init)=>{
  calls++
  const body=JSON.parse(init.body)
  if(calls===1)assert.ok(body.messages[0].content.includes('TRANSCRIPTION'))
  const facts={...evidence,source:url,vintageMatched:true,vintageEvidence:'2021',grapes:[{name:'Cabernet Franc',evidence:'Cabernet Franc'}],blendRatio:null}
  return {stop_reason:'end_turn',content:[{type:'web_search_tool_result',content:[{type:'web_search_result',url}]},{type:'web_fetch_tool_result',content:{type:'web_fetch_result',url,content:{source:{type:'text',data:doc}}}},{type:'text',text:JSON.stringify(facts)}]}
 }}}).enrichGrapes
 const badRoles={...observed,producer:'Rivage',region:'Reserve',grapeVariety:'Cabernet Franc'}
 const result=await enrich(badRoles,'ko','test-key',false,badRoles)
 assert.equal(calls,1);assert.equal(result.producer,'Domaine Rivage');assert.equal(result.region,'Loire')
 assert.equal(result.grapeVariety,'Cabernet Franc');assert.equal(result.wineResearch.status,'verified')
})
