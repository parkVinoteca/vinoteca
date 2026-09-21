const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const { displayJapaneseWine, readJapaneseWine } = load('src/lib/server/wineDisplay.ts')
const ai = load('src/lib/server/ai.ts')
const original = ai.validateLabel({wineName:'Cellar Selection Sauvignon Blanc',producer:'Sileni',country:'New Zealand',region:'Marlborough',grapeVariety:'Sauvignon Blanc',wineType:'white',vintage:'2025'})
const names = {wineNameJa:'セラー・セレクション・ソーヴィニヨン・ブラン',producerJa:'シレーニ',countryJa:'ニュージーランド',regionJa:'マールボロ',grapeVarietyJa:'ソーヴィニヨン・ブラン'}
test('Japanese display uses katakana wine and bilingual producer without changing year or evidence',()=>{
 const r=displayJapaneseWine({...original,source:'https://example.com'},original,readJapaneseWine(names),'ja')
 assert.equal(r.wineName,names.wineNameJa);assert.equal(r.producer,'Sileni / シレーニ')
 assert.equal(r.vintage,'2025');assert.equal(r.source,'https://example.com')
 assert.equal(displayJapaneseWine(original,original,readJapaneseWine(names),'ko'),original)
})
test('A corrected identity or rejected grape never inherits the earlier translated guess',()=>{
 const r=displayJapaneseWine({...original,wineName:'Grand Reserve',grapeVariety:null},original,readJapaneseWine(names),'ja')
 assert.equal(r.wineName,'Grand Reserve');assert.equal(r.grapeVariety,null)
 assert.deepEqual({...readJapaneseWine({wineNameJa:'<script>ワイン</script>',producerJa:'Sileni'})},{})
})
test('Slow Gemini hands over at 15 seconds and completes once using Haiku without another quota reservation',async()=>{
 let reservations=0;const timeouts=[]
 const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'test',ANTHROPIC_API_KEY:'test'}}},{
  '@/lib/server/ai':{...ai,authorize:async()=>({}),readImage:async()=>({lang:'ja'}),reserveUsage:async()=>{reservations++},providerFetch:async(url,init,timeout)=>{
   timeouts.push(timeout)
   if(url.includes('googleapis'))throw new ai.ApiError('provider_timeout',502)
   return {stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify({...original,labelText:'Sileni Cellar Selection Sauvignon Blanc Marlborough New Zealand 2025',knowledge:{...original,confident:true},...names})}]}
  }},
  '@/lib/server/wineLookup':{resolveWine:async reading=>reading.knowledge},
 })
 const response=await handler.POST(new Request('http://localhost/api/label'))
 assert.equal(response.status,200);assert.equal(reservations,1)
 assert.deepEqual(timeouts,[15000,30000])
 const body=await response.json();assert.equal(body.provider,'claude');assert.equal(body.result.producer,'Sileni / シレーニ')
 assert.equal(body.result.japanese,undefined)
})
