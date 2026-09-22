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
test('Gemini alone returns Japanese display with one quota reservation and no research call',async()=>{
 let reservations=0,calls=0
 const handler=load('src/app/api/label/route.ts',{process:{env:{GEMINI_API_KEY:'test'}}},{
  '@/lib/server/ai':{...ai,authorize:async()=>({}),readImage:async()=>({lang:'ja'}),reserveUsage:async()=>{reservations++},providerFetch:async(url,init,timeout)=>{
   calls++;assert.ok(url.includes('googleapis.com'));assert.equal(timeout,60000)
   const config=JSON.parse(init.body).generationConfig
   assert.equal(config.thinkingConfig.thinkingLevel,'minimal')
   return {candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({vintage:'2025',labelText:'Sileni Cellar Selection Sauvignon Blanc Marlborough New Zealand 2025',knowledge:{...original,confident:true},...names})}]}}]}
  }},
 })
 const response=await handler.POST(new Request('http://localhost/api/label'))
 assert.equal(response.status,200);assert.equal(reservations,1);assert.equal(calls,1)
 const body=await response.json();assert.equal(body.provider,'gemini');assert.equal(body.result.producer,'Sileni / シレーニ')
 assert.equal(body.result.japanese,undefined)
})

test('Japanese katakana spacing is consistent for cropped and full-photo answers',()=>{
 const a=readJapaneseWine({wineNameJa:'セラー・セレクション ソーヴィニヨン・ブラン',grapeVarietyJa:'ソーヴィニヨン・ブラン'})
 const b=readJapaneseWine({wineNameJa:'セラー セレクション ソーヴィニヨン ブラン',grapeVarietyJa:'ソーヴィニヨン ブラン'})
 assert.deepEqual(a,b)
 assert.equal(a.wineName,'セラー・セレクション・ソーヴィニヨン・ブラン')
})
