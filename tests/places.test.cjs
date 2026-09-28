const test=require('node:test')
const assert=require('node:assert/strict')
const {load}=require('./helpers.cjs')
const {parsePlacesRequest,publicPlace}=load('src/lib/server/places.ts')
test('Places input rejects invalid coordinates, ids and languages',()=>{
 assert.equal(parsePlacesRequest({kind:'nearby',lang:'ja',lat:35,lng:139}).lat,35)
 for(const body of [null,{kind:'nearby',lang:'ja',lat:91,lng:139},{kind:'nearby',lang:'ko',lat:0,lng:Infinity},{kind:'detail',lang:'ja',id:'../../secret'},{kind:'detail',lang:'en',id:'ChIJtest'}])assert.throws(()=>parsePlacesRequest(body))
})
test('Places output limits fields and removes unsafe attribution links',()=>{
 const p=publicPlace({id:'ChIJtest',displayName:{text:'Restaurant'},formattedAddress:'Tokyo',location:{latitude:35},attributions:[{provider:'Source',providerUri:'javascript:alert(1)'}]})
 assert.equal(p.name,'Restaurant');assert.equal(p.location,undefined);assert.equal(p.attributions[0].url,null)
 assert.equal(publicPlace({id:'invalid/id'}),null)
})
test('Places endpoint disabled configuration never calls provider or consumes quota',async()=>{
 let calls=0
 const route=load('src/app/api/places/route.ts',{fetch:()=>{calls++;throw Error('unexpected')}},{'@/lib/server/ai':{authorize:async()=>({rpc:()=>{calls++}}),ApiError:class extends Error{constructor(code,status){super(code);this.code=code;this.status=status}},failure:e=>Response.json({error:e.code},{status:e.status})}})
 const result=await route.POST(new Request('https://example.com/api/places',{method:'POST'}))
 assert.equal(result.status,503);assert.equal(calls,0)
})
test('Enabled nearby lookup uses Pro-only fields after atomic reservation',async()=>{
 let reserved=false,requests=0
 const route=load('src/app/api/places/route.ts',{
  process:{env:{GOOGLE_PLACES_ENABLED:'true',GOOGLE_PLACES_API_KEY:'test-only'}},
  fetch:async(url,init)=>{requests++;assert.equal(reserved,true);assert.equal(url,'https://places.googleapis.com/v1/places:searchNearby');assert.equal(init.cache,'no-store');assert.equal(init.headers['X-Goog-FieldMask'],'places.id,places.displayName,places.formattedAddress,places.attributions');const body=JSON.parse(init.body);assert.equal(body.locationRestriction.circle.radius,500);return Response.json({places:[{id:'ChIJtest',displayName:{text:'Cafe'},formattedAddress:'Tokyo'}]})}
 },{'@/lib/server/ai':{authorize:async()=>({rpc:async()=>{reserved=true;return {data:true}}}),ApiError:class extends Error{},failure:()=>Response.json({error:'unexpected'},{status:500})}})
 const response=await route.POST(new Request('https://example.com/api/places',{method:'POST',body:JSON.stringify({kind:'nearby',lat:35,lng:139,lang:'ja'})}))
 assert.equal(response.status,200);assert.equal(requests,1);assert.equal((await response.json()).places[0].name,'Cafe');assert.equal(response.headers.get('cache-control'),'no-store')
})
test('Exhausted Maps quota blocks provider calls',async()=>{
 let calls=0
 const route=load('src/app/api/places/route.ts',{process:{env:{GOOGLE_PLACES_ENABLED:'true',GOOGLE_PLACES_API_KEY:'test-only'}},fetch:()=>{calls++}},
 {'@/lib/server/ai':{authorize:async()=>({rpc:async()=>({data:false})}),ApiError:class extends Error{constructor(code,status){super(code);this.code=code;this.status=status}},failure:e=>Response.json({error:e.code},{status:e.status})}})
 const response=await route.POST(new Request('https://example.com/api/places',{method:'POST',body:JSON.stringify({kind:'detail',id:'ChIJtest',lang:'ko'})}))
 assert.equal(response.status,429);assert.equal(calls,0)
})
