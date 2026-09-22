const test=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./helpers.cjs')
const {readWineAnalysis,knowledgeResult}=load('src/lib/server/wineAnalysis.ts')
function sample(producer,wineName,country,region,grapeVariety){
 return {labelText:`${producer} ${wineName} 2022`,wineName,producer,vintage:'2022',knowledge:{confident:true,wineName,producer,country,region,grapeVariety,wineType:'white'}}
}
test('Wine knowledge complements visible labels without pretending to be web verified',()=>{
 for(const raw of [sample("Domaine de l'Enclos",'Chablis','France','Bourgogne, Chablis','Chardonnay'),sample('Weingut Example','Riesling','Germany','Mosel','Riesling')]){
  const reading=readWineAnalysis(raw), result=knowledgeResult(reading)
  assert.equal(reading.country,null)
  assert.equal(result.country,raw.knowledge.country)
  assert.equal(result.producer,raw.producer)
  assert.equal(result.grapeResearch.status,'knowledge')
  assert.equal(result.wineResearch.source,null)
  assert.equal(result.grapeResearch.blendRatio,null)
 }
})
test('Unknown identities, percentages, invented years and changed cuvees cannot use fast knowledge path',()=>{
 const good=sample("Domaine de l'Enclos",'Chablis','France','Chablis','Chardonnay')
 for(const k of [{confident:false},{producer:'Unrelated winery'}])
  assert.equal(readWineAnalysis({...good,knowledge:{...good.knowledge,...k}}).knowledge,undefined)
 assert.equal(readWineAnalysis({...good,labelText:good.labelText.replace('Chablis','Petit Chablis')}).knowledge,undefined)
 assert.equal(knowledgeResult(readWineAnalysis({...good,vintage:'2023'})).vintage,null)
})
test('Complete knowledge avoids paid research and does not write a shared verified cache',async()=>{
 const resolver=load('src/lib/server/wineLookup.ts',{}, {'next/cache':{unstable_cache:()=>{throw Error('must not cache suggestion')}},'@/lib/server/grapes':{enrichGrapes:()=>{throw Error('must not pay for complete basic fields')}}})
 const result=await resolver.resolveWine(readWineAnalysis(sample('Weingut Example','Riesling','Germany','Mosel','Riesling')),'key')
 assert.equal(result.wineResearch.status,'knowledge')
})
test('Source typography normalization tolerates curly apostrophes without inventing words',()=>{
 const {normalizeEvidence}=load('src/lib/server/grapes.ts')
 assert.equal(normalizeEvidence("Cépage : Chardonnay\u00a0— l’Enclos"),normalizeEvidence("Cépage : Chardonnay - l'Enclos"))
 assert.notEqual(normalizeEvidence('Chardonnay'),normalizeEvidence('Chenin'))
 assert.equal(normalizeEvidence('Chardonnay\n  et\tPinot'),normalizeEvidence('Chardonnay et Pinot'))
})

test('One unknown field does not discard independently known information or start paid research',async()=>{
 const raw=sample("Domaine de l'Enclos",'Chablis','France',null,'Chardonnay')
 const reading=readWineAnalysis(raw)
 assert.equal(knowledgeResult(reading).country,'France')
 assert.equal(knowledgeResult(reading).region,null)
 const noGrape=readWineAnalysis({...raw,knowledge:{...raw.knowledge,grapeVariety:null}})
 assert.equal(knowledgeResult(noGrape).country,'France')
 assert.equal(knowledgeResult(noGrape).grapeResearch.status,'not_found')
 const ratios=readWineAnalysis({...raw,knowledge:{...raw.knowledge,grapeVariety:'Chardonnay 100%'}})
 assert.equal(knowledgeResult(ratios).grapeVariety,null)
 assert.equal(knowledgeResult(ratios).country,'France')
})
