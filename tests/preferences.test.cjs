const test=require('node:test'), assert=require('node:assert/strict')
const {load}=require('./helpers.cjs')
const {calculateTasteProfile:profile,calculateMatchScore:match,buildMatchReason:reason}=load('src/lib/tastePofile.ts')
const {sommelierPersonalLine}=load('src/lib/sommelierNote.ts')
const base={wine_type:'red',score:null,tannin:null,alcohol:null,grape_variety:null,region:null,country:null}
const records=[{...base,stars:3,body:'light',acidity:'high'},{...base,stars:2.8,body:'light',acidity:'high'},{...base,stars:1,body:'full',acidity:'low'},{...base,stars:1.2,body:'full',acidity:'low'}]
const light={body:1,acidity:5},heavy={body:5,acidity:1}
test('Strict scorers learn likes and dislikes without any 4-star ratings',()=>{
 const p=profile(records)
 assert.equal(p.samples.length,4)
 assert.ok(match(p,light).score>=65)
 assert.ok(match(p,heavy).score<=35)
 assert.match(reason('ko',match(p,heavy)),/낮게 평가/)
})
test('Changing a formerly liked style to low ratings reduces its recommendation',()=>{
 const positive=profile([...records.slice(0,2),...records.slice(2).map(r=>({...r,stars:4.8}))])
 assert.ok(match(profile(records),heavy).score < match(positive,heavy).score)
})
test('Uniform personal rating offsets do not change preference ranking',()=>{
 const stricter=profile(records), generous=profile(records.map(r=>({...r,stars:r.stars+1.5})))
 assert.equal(match(stricter,light).score,match(generous,light).score)
 assert.equal(match(stricter,heavy).score,match(generous,heavy).score)
})
test('Flat ratings, missing fields and distant histories do not fabricate confidence',()=>{
 assert.equal(match(profile(records.map(r=>({...r,stars:2}))),light).score,null)
 assert.equal(match(profile(records.map(r=>({...r,acidity:null}))),light).score,null)
 assert.equal(match(profile(records.slice(0,2)),light).score,null)
 assert.equal(match(profile(records),{body:99,acidity:5}).score,null)
})
test('Sommelier personal line is cautious when fit is low or unknown',()=>{
 assert.match(sommelierPersonalLine('ko',20),/낮게 평가/)
 assert.match(sommelierPersonalLine('ja',null),/これから/)
 assert.doesNotMatch(sommelierPersonalLine('ko',null),/강력추천|딱 맞/)
})
