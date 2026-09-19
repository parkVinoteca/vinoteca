const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./helpers.cjs')
const { personalRating, formatRating } = load('src/lib/ratings.ts')
const { calculateTasteProfile } = load('src/lib/tastePofile.ts')
const { verifyCriticScores } = load('src/lib/criticScores.ts')
test('Fractional ratings win over legacy scores; unscored stays unscored', () => {
 assert.equal(personalRating({stars:4.1, score:10}),4.1)
 assert.equal(formatRating({score:7}), '3.5')
 assert.equal(personalRating({stars:null,score:null}),null)
 assert.equal(personalRating({stars:NaN,score:11}),null)
 assert.equal(formatRating({score:1}), '0.5')
})
test('Both input modes use 4.0 as preference threshold, with stars authoritative', () => {
 const record={body:'full',tannin:null,acidity:null,alcohol:null,grape_variety:null,country:null,region:null,wine_type:'red'}
 assert.equal(calculateTasteProfile([{...record,score:7}]),null)
 assert.equal(calculateTasteProfile([{...record,score:10,stars:3.9}]),null)
 assert.equal(calculateTasteProfile([{...record,score:null,stars:4}]).bodyScore,5)
 assert.equal(calculateTasteProfile([{...record,score:8}]).avgScore,4)
})
test('Type-specific simple descriptors are available in expert vocabulary in both languages', () => {
 for (const lang of ['ja','ko']) {
  const t=load(`src/i18n/${lang}.ts`)[lang]
  const all=[...t.nose.primaryAromas,...t.nose.secondaryAromas,...t.nose.tertiaryAromas]
  for (const aromas of Object.values(t.simpleAromas)) for(const a of aromas) assert.ok(all.includes(a), a)
  assert.notDeepEqual(t.simpleAromas.red,t.simpleAromas.white)
  assert.equal(t.appearance.depthLevels.length,3)
  assert.equal(t.palate.sweetnessLevels.length,6)
 }
})
test('Critic scores require a fetched exact wine/vintage quote and adjacent critic points', () => {
 const label={wineName:'Reserve Margaux',producer:'Mouton Cadet',vintage:'2022'}
 const source='https://example.com/wine'
 const evidence='Mouton Cadet Reserve Margaux 2022. James Suckling: 92 points.'
 const item={critic:'JS',score:92,source,evidence,vintage:'2022'}
 const docs=new Map([[source,evidence]])
 assert.equal(verifyCriticScores([item],docs,label).length,1)
 for(const change of [{vintage:'2021'},{score:94},{critic:'WA'},{source:'https://invented.test'},{evidence:evidence+' invented'}]) assert.equal(verifyCriticScores([{...item,...change}],docs,label).length,0)
 assert.equal(verifyCriticScores([item],docs,{...label,wineName:'Reserve Pauillac'}).length,0)
 assert.equal(verifyCriticScores([item],new Map(),label).length,0)
})
test('Barrel ranges and mixed-vintage passages are hidden', () => {
 const label={wineName:'Reserve Margaux',producer:'Mouton Cadet',vintage:'2022'}
 for(const evidence of ['Mouton Cadet Reserve Margaux 2022. James Suckling 92–94.', 'Mouton Cadet Reserve Margaux 2022 and 2021. James Suckling 92.']) {
  const source='https://example.com/wine'
  assert.equal(verifyCriticScores([{critic:'JS',score:92,vintage:'2022',source,evidence}],new Map([[source,evidence]]),label).length,0)
 }
})
test('Displayed release version matches the package version', () => {
 const version=require('../package.json').version.replace(/\.0$/, '')
 assert.equal(load('src/lib/productConfig.ts').APP_VERSION,version)
})
