const test = require('node:test')
const assert = require('node:assert/strict')
const {load} = require('./helpers.cjs')
const {countryKey,countryLabel} = load('src/lib/countries.ts')
test('Country filters combine languages, case and spacing without mutating records',()=>{
 const source=['Spain','spain',' スペイン ','스페인','España']
 assert.equal(new Set(source.map(countryKey)).size,1)
 assert.equal(source.filter(v=>countryKey(v)==='ES').length,5)
 for(const v of source){assert.equal(countryLabel(v,'ja'),'スペイン');assert.equal(countryLabel(v,'ko'),'스페인')}
 assert.equal(countryLabel('New Zealand','ja'),'ニュージーランド')
 assert.equal(countryLabel('France','ja'),'フランス')
 assert.equal(countryKey('U.S.A.'),countryKey('アメリカ合衆国'))
 assert.equal(countryLabel('Unknown wine place','ja'),'Unknown wine place')
 assert.equal(countryKey(null),'')
 assert.equal(countryLabel(null,'ko'),'')
})
